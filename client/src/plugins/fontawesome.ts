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
  faTimesCircle,

  // MCP & Development
  faCodeBranch,
  faPlug,
  faClock,

  // Auth & Login
  faEnvelope,
  faLock,
  faSignInAlt,
  faPlay,
  faArrowRightFromBracket,
} from '@fortawesome/free-solid-svg-icons'

import {
  // Regular icons for subtle states
  faComment as faCommentRegular,
  faCopy as faCopyRegular,
} from '@fortawesome/free-regular-svg-icons'
import { faGithub, faGoogle } from '@fortawesome/free-brands-svg-icons'

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
  // Ensure we have both solid and regular versions of icons
  faCommentRegular,
  faCopyRegular,
  faTimesCircle,

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

  // Auth & Login
  faEnvelope,
  faLock,
  faSignInAlt,
  faPlay,
  faArrowRightFromBracket,
  faGithub,
  faGoogle,

  // Regular icons
  faCommentRegular,
  faCopyRegular,
)

export default FontAwesomeIcon
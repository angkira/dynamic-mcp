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

  faUser,
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
  faWrench,
  // States
  faSpinner,
  faCheck,
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
  faBell,
  faTriangleExclamation,
  faCircleExclamation,
  faCircleCheck,
  faCircleInfo,
  faXmark,
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

  faUser,

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
  faWrench,

  // States
  faSpinner,
  faCheck,
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
  faBell,
  faTriangleExclamation,
  faCircleExclamation,
  faCircleCheck,
  faCircleInfo,
  faXmark,
  faGithub,
  faGoogle,

  // Regular icons
  faCommentRegular,
  faCopyRegular,
)

export default FontAwesomeIcon
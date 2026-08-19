/**
 * 會員列表頁專用的 FontAwesome icon 註冊（prototype 版）。
 *
 * 來源 portal 用 FA Pro 的 `far`（線框）；此頁模板原樣保留 `['far', X]`，
 * 故 `far` 一律取自 Pro kit 的 classic/regular（free-regular 缺 lock / chevron /
 * search / ban / ellipsis-vertical 等）。`fas` 取自 free-solid，
 * 平台品牌 icon 取自 free-brands 的 `fab`。由 main.ts 以 side-effect import 一次即可。
 */
import { library } from '@fortawesome/fontawesome-svg-core'

// far（Pro kit classic/regular）— 頁面模板保留 ['far', X] 的線框圖示
import {
  faArrowUpRightFromSquare,
  faBan,
  faBell,
  faChevronLeft,
  faChevronRight,
  faComment,
  faEllipsisVertical,
  faEnvelope,
  faEye,
  faEyeSlash,
  faLock,
  faLockOpen,
  faPaperPlane,
  faRectangleList,
  faSearch,
  faStar as faStarRegular,
} from '@awesome.me/kit-979923bcd0/icons/classic/regular'

// fas（free-solid）— 星等實心、紅利點數
import {
  faCoins,
  faStar as faStarSolid,
} from '@fortawesome/free-solid-svg-icons'

// fab（free-brands）— 第三方綁定 / 發送管道品牌識別
import {
  faFacebook,
  faGoogle,
  faLine,
  faTiktok,
  faWhatsapp,
} from '@fortawesome/free-brands-svg-icons'

library.add(
  faArrowUpRightFromSquare,
  faBan,
  faBell,
  faChevronLeft,
  faChevronRight,
  faComment,
  faEllipsisVertical,
  faEnvelope,
  faEye,
  faEyeSlash,
  faLock,
  faLockOpen,
  faPaperPlane,
  faRectangleList,
  faSearch,
  faStarRegular,
  faCoins,
  faStarSolid,
  faFacebook,
  faGoogle,
  faLine,
  faTiktok,
  faWhatsapp,
)

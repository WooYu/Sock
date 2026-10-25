let locks = 0
let restore: (() => void) | undefined

/** Share one scroll lock across sheets and nested dialogs. */
export function lockPageScroll() {
  if (locks === 0) {
    const root = document.documentElement, body = document.body
    const previous = { root: root.style.overflow, body: body.style.overflow, overscroll: root.style.overscrollBehavior, x: window.scrollX, y: window.scrollY }
    root.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    root.style.overscrollBehavior = 'none'
    restore = () => {
      root.style.overflow = previous.root
      body.style.overflow = previous.body
      root.style.overscrollBehavior = previous.overscroll
      if (window.scrollX !== previous.x || window.scrollY !== previous.y) window.scrollTo({ left: previous.x, top: previous.y, behavior: 'instant' })
    }
  }
  locks++
  let released = false
  return () => {
    if (released) return
    released = true
    if (--locks === 0) { restore?.(); restore = undefined }
  }
}

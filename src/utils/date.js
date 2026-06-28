export function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTodayDate() {
  return formatDate(new Date())
}

export function getDateLabel(dateStr) {
  const date = new Date(dateStr)
  const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return {
    monthDay: `${date.getMonth() + 1}月${date.getDate()}日`,
    weekday: weekMap[date.getDay()]
  }
}

export function formatDateText(dateStr) {
  const { monthDay, weekday } = getDateLabel(dateStr)
  return `${monthDay} ${weekday}`
}

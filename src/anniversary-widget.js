const STORAGE_KEY = "anniversary_widget_config_v3"
const BG_IMAGE_FILE = "anniversary_widget_bg.jpg"

async function main() {
  let saved = loadSavedConfig()

  if (config.runsInApp || !saved) {
    try {
      saved = await promptForConfig(saved)
      if (saved) {
        saveConfig(saved)
      }
    } catch (e) {
      await showErrorWidget("设置失败", String(e))
      return
    }
  }

  if (!saved) {
    await showErrorWidget("还没有设置纪念日", "先在 Scriptable 里运行一次脚本")
    return
  }

  const widget = buildWidget(saved)
  Script.setWidget(widget)

  if (config.runsInApp) {
    await widget.presentSmall()
  }

  Script.complete()
}

function loadSavedConfig() {
  try {
    if (!Keychain.contains(STORAGE_KEY)) return null
    const raw = Keychain.get(STORAGE_KEY)
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

function saveConfig(data) {
  Keychain.set(STORAGE_KEY, JSON.stringify(data))
}

async function promptForConfig(oldData) {
  const alert = new Alert()
  alert.title = "设置纪念日"
  alert.message = "请输入标题、年月日，并选择背景"

  alert.addTextField("标题", oldData?.title || "结婚纪念日")
  alert.addTextField("年", oldData?.year ? String(oldData.year) : "2020")
  alert.addTextField("月", oldData?.month ? String(oldData.month) : "6")
  alert.addTextField("日", oldData?.day ? String(oldData.day) : "1")

  alert.addAction("下一步")
  if (oldData) {
    alert.addAction("继续使用当前设置")
  }
  alert.addCancelAction("取消")

  const index = await alert.presentAlert()

  if (index === -1) {
    return oldData || null
  }

  if (oldData && index === 1) {
    return oldData
  }

  const title = alert.textFieldValue(0).trim()
  const year = Number(alert.textFieldValue(1).trim())
  const month = Number(alert.textFieldValue(2).trim())
  const day = Number(alert.textFieldValue(3).trim())

  if (!title) {
    throw new Error("标题不能为空")
  }

  if (!Number.isInteger(year) || year < 1900 || year > 2999) {
    throw new Error("年份不正确")
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("月份必须是 1 到 12")
  }

  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error("日期必须是 1 到 31")
  }

  const testDate = new Date(year, month - 1, day)
  if (
    testDate.getFullYear() !== year ||
    testDate.getMonth() !== month - 1 ||
    testDate.getDate() !== day
  ) {
    throw new Error("日期不存在，请重新输入")
  }

  const bg = await promptForBackground(oldData?.bg)

  return { title, year, month, day, bg }
}

async function promptForBackground(oldBg) {
  const bgAlert = new Alert()
  bgAlert.title = "选择背景"
  bgAlert.message = "默认推荐：透明感"

  bgAlert.addAction("透明感")
  bgAlert.addAction("深色")
  bgAlert.addAction("浅色")
  bgAlert.addAction("相册图片")
  if (oldBg) {
    bgAlert.addAction("沿用当前背景")
  }
  bgAlert.addCancelAction("取消")

  const choice = await bgAlert.presentAlert()

  if (choice === -1) {
    return oldBg || { type: "transparent" }
  }

  if (oldBg && choice === 4) {
    return oldBg
  }

  if (choice === 0) {
    return { type: "transparent" }
  }

  if (choice === 1) {
    return { type: "dark" }
  }

  if (choice === 2) {
    return { type: "light" }
  }

  if (choice === 3) {
    const img = await Photos.fromLibrary()
    const fm = FileManager.local()
    const path = fm.joinPath(fm.documentsDirectory(), BG_IMAGE_FILE)
    fm.writeImage(path, img)
    return { type: "photo" }
  }

  return { type: "transparent" }
}

function buildWidget(saved) {
  const widget = new ListWidget()
  widget.setPadding(16, 16, 16, 16)

  applyBackground(widget, saved.bg)

  const targetDate = new Date(saved.year, saved.month - 1, saved.day)
  const today = startOfDay(new Date())
  const target = startOfDay(targetDate)

  const diffDays = Math.floor((today - target) / 86400000)

  const titleColor = textColorForBackground(saved.bg, "title")
  const subColor = textColorForBackground(saved.bg, "sub")

  const titleText = widget.addText(saved.title)
  titleText.font = Font.boldSystemFont(16)
  titleText.lineLimit = 1
  titleText.textColor = titleColor

  widget.addSpacer(10)

  const mainText = widget.addText(
    diffDays >= 0 ? `第 ${diffDays} 天` : `还有 ${Math.abs(diffDays)} 天`
  )
  mainText.font = Font.boldSystemFont(28)
  mainText.lineLimit = 1
  mainText.minimumScaleFactor = 0.6
  mainText.textColor = titleColor

  widget.addSpacer(8)

  const dateText = widget.addText(
    `${saved.year}-${pad2(saved.month)}-${pad2(saved.day)}`
  )
  dateText.font = Font.systemFont(12)
  dateText.textColor = subColor

  widget.addSpacer()

  const todayText = widget.addText(`今天 ${formatDate(today)}`)
  todayText.font = Font.systemFont(11)
  todayText.textColor = subColor

  const now = new Date()
  widget.refreshAfterDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0
  )

  return widget
}

function applyBackground(widget, bg) {
  const type = bg?.type || "transparent"

  if (type === "photo") {
    const fm = FileManager.local()
    const path = fm.joinPath(fm.documentsDirectory(), BG_IMAGE_FILE)
    if (fm.fileExists(path)) {
      widget.backgroundImage = fm.readImage(path)

      const gradient = new LinearGradient()
      gradient.colors = [
        new Color("#000000", 0.12),
        new Color("#000000", 0.35)
      ]
      gradient.locations = [0, 1]
      widget.backgroundGradient = gradient
      return
    }
  }

  if (type === "dark") {
    const gradient = new LinearGradient()
    gradient.colors = [
      new Color("#1C1C1E", 0.95),
      new Color("#2C2C2E", 0.88)
    ]
    gradient.locations = [0, 1]
    widget.backgroundGradient = gradient
    return
  }

  if (type === "light") {
    const gradient = new LinearGradient()
    gradient.colors = [
      new Color("#F2F2F7", 0.92),
      new Color("#E5E5EA", 0.88)
    ]
    gradient.locations = [0, 1]
    widget.backgroundGradient = gradient
    return
  }

  // 默认：透明感（不用截图）
  const gradient = new LinearGradient()
  gradient.colors = [
    new Color("#1C1C1E", 0.35),
    new Color("#2C2C2E", 0.22)
  ]
  gradient.locations = [0, 1]
  widget.backgroundGradient = gradient
}

function textColorForBackground(bg, kind) {
  const type = bg?.type || "transparent"

  if (type === "light") {
    return kind === "title"
      ? new Color("#111111")
      : new Color("#111111", 0.65)
  }

  return kind === "title"
    ? Color.white()
    : new Color("#FFFFFF", 0.72)
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function pad2(n) {
  return String(n).padStart(2, "0")
}

function formatDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

async function showErrorWidget(title, message) {
  const widget = new ListWidget()
  widget.setPadding(16, 16, 16, 16)

  const gradient = new LinearGradient()
  gradient.colors = [
    new Color("#1C1C1E", 0.95),
    new Color("#2C2C2E", 0.90)
  ]
  gradient.locations = [0, 1]
  widget.backgroundGradient = gradient

  const t1 = widget.addText(title)
  t1.font = Font.boldSystemFont(16)
  t1.textColor = Color.white()

  widget.addSpacer(8)

  const t2 = widget.addText(message)
  t2.font = Font.systemFont(12)
  t2.textColor = new Color("#FFFFFF", 0.8)

  Script.setWidget(widget)

  if (config.runsInApp) {
    await widget.presentSmall()
  }

  Script.complete()
}

await main()

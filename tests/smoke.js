const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { foods, categories } = require('../miniprogram/data/catalog')
const dates = require('../miniprogram/utils/date')

const root = path.resolve(__dirname, '..')
const jsFiles = []
function walk(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const target = path.join(folder, entry.name)
    if (entry.isDirectory()) walk(target)
    else if (entry.name.endsWith('.js')) jsFiles.push(target)
  }
}
walk(path.join(root, 'miniprogram'))
walk(path.join(root, 'cloudfunctions'))
for (const file of jsFiles) execFileSync(process.execPath, ['--check', file])

assert(foods.length >= 24, '内置菜品应至少有 24 道')
assert.strictEqual(new Set(foods.map(item => item.id)).size, foods.length, '菜品 id 必须唯一')
assert(categories.some(item => item.id === 'favorite'), '必须有收藏分类')
for (const food of foods) {
  assert(food.name && food.emoji && food.category, `菜品字段不完整: ${food.id}`)
  assert(categories.some(category => category.id === food.category), `未知分类: ${food.category}`)
}

assert.strictEqual(dates.dateKey(new Date(2026, 7, 21, 2, 3)), '2026-08-21')
assert.strictEqual(dates.timeText(new Date(2026, 7, 21, 2, 3)), '02:03')

const appConfig = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json')))
for (const page of appConfig.pages) {
  for (const ext of ['js', 'json', 'wxml', 'wxss']) {
    assert(fs.existsSync(path.join(root, 'miniprogram', `${page}.${ext}`)), `页面文件缺失: ${page}.${ext}`)
  }
}
for (const fn of ['auth', 'room', 'favorites', 'spin', 'records', 'profile']) {
  assert(fs.existsSync(path.join(root, 'cloudfunctions', fn, 'index.js')), `云函数缺失: ${fn}`)
}

const packageBytes = (() => {
  let total = 0
  function sum(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const target = path.join(folder, entry.name)
      if (entry.isDirectory()) sum(target)
      else total += fs.statSync(target).size
    }
  }
  sum(path.join(root, 'miniprogram'))
  return total
})()
assert(packageBytes < 2 * 1024 * 1024, `主包超过 2MB: ${packageBytes}`)
console.log(`✓ ${jsFiles.length} 个 JS 文件通过语法检查`)
console.log(`✓ ${foods.length} 道内置菜品与 ${categories.length} 个分类通过校验`)
console.log(`✓ 6 个页面、6 个云函数结构完整`)
console.log(`✓ 小程序主包约 ${Math.round(packageBytes / 1024)}KB`)

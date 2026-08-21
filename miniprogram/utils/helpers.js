function shuffle(list) {
  const output = list.slice()
  for (let index = output.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1))
    const temp = output[index]
    output[index] = output[next]
    output[next] = temp
  }
  return output
}

function initials(name) {
  return (name || '鸭').trim().slice(0, 1)
}

function debounce(fn, delay = 300) {
  let timer
  return function debounced(...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

module.exports = { shuffle, initials, debounce }

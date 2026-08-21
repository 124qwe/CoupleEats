const categories = [
  { id: 'all', name: '全部', emoji: '🍽️' },
  { id: 'hotpot', name: '火锅', emoji: '🍲' },
  { id: 'japanese', name: '日料', emoji: '🍣' },
  { id: 'home', name: '家常菜', emoji: '🥘' },
  { id: 'bbq', name: '烧烤', emoji: '🍢' },
  { id: 'fast', name: '快餐', emoji: '🍔' },
  { id: 'dessert', name: '甜品', emoji: '🍰' },
  { id: 'favorite', name: '收藏', emoji: '💗' }
]

const foods = [
  { id: 'builtin-hotpot-spicy', name: '重庆火锅', category: 'hotpot', emoji: '🌶️', desc: '毛肚鸭肠，越煮越香', tags: ['热辣', '聚餐'], color: '#ffd9d7' },
  { id: 'builtin-hotpot-copper', name: '老北京涮肉', category: 'hotpot', emoji: '🥩', desc: '铜锅清汤，麻酱满分', tags: ['暖胃', '羊肉'], color: '#ffe7bd' },
  { id: 'builtin-hotpot-coconut', name: '椰子鸡', category: 'hotpot', emoji: '🥥', desc: '清甜椰香，今晚轻松吃', tags: ['清淡', '鸡肉'], color: '#eaf2c8' },
  { id: 'builtin-hotpot-skewer', name: '串串香', category: 'hotpot', emoji: '🍡', desc: '一把一把涮着吃', tags: ['丰富', '香辣'], color: '#ffd4b8' },
  { id: 'builtin-jp-sushi', name: '寿司拼盘', category: 'japanese', emoji: '🍣', desc: '一口一个的新鲜满足', tags: ['鲜美', '精致'], color: '#ffd8cf' },
  { id: 'builtin-jp-ramen', name: '豚骨拉面', category: 'japanese', emoji: '🍜', desc: '浓厚汤底配溏心蛋', tags: ['主食', '浓香'], color: '#ffe6b7' },
  { id: 'builtin-jp-eel', name: '鳗鱼饭', category: 'japanese', emoji: '🍱', desc: '焦香鳗鱼铺满米饭', tags: ['招牌', '甜咸'], color: '#e7d7bd' },
  { id: 'builtin-jp-yakiniku', name: '日式烧肉', category: 'japanese', emoji: '🥓', desc: '滋滋冒油，幸福加倍', tags: ['肉肉', '约会'], color: '#ffd1c5' },
  { id: 'builtin-home-pork', name: '红烧肉', category: 'home', emoji: '🍖', desc: '软糯入味，米饭搭档', tags: ['下饭', '浓香'], color: '#eac3a7' },
  { id: 'builtin-home-tomato', name: '番茄炒蛋', category: 'home', emoji: '🍅', desc: '酸甜家常，百吃不厌', tags: ['快手', '酸甜'], color: '#ffd3a8' },
  { id: 'builtin-home-fish', name: '酸菜鱼', category: 'home', emoji: '🐟', desc: '嫩滑鱼片，酸爽开胃', tags: ['开胃', '鱼肉'], color: '#e8edbd' },
  { id: 'builtin-home-ribs', name: '糖醋排骨', category: 'home', emoji: '🥢', desc: '酸甜酱汁裹满排骨', tags: ['招牌', '酸甜'], color: '#f1c7b7' },
  { id: 'builtin-bbq-skewer', name: '东北烧烤', category: 'bbq', emoji: '🍢', desc: '撸串聊天，快乐翻倍', tags: ['夜宵', '热闹'], color: '#ffd0aa' },
  { id: 'builtin-bbq-korean', name: '韩式烤肉', category: 'bbq', emoji: '🥩', desc: '生菜包肉，一口满足', tags: ['肉肉', '约会'], color: '#f4c4af' },
  { id: 'builtin-bbq-fish', name: '炭火烤鱼', category: 'bbq', emoji: '🐠', desc: '外焦里嫩，香气扑鼻', tags: ['香辣', '聚餐'], color: '#f0d1ad' },
  { id: 'builtin-bbq-oyster', name: '烤生蚝', category: 'bbq', emoji: '🦪', desc: '蒜蓉满满，鲜味十足', tags: ['海鲜', '蒜香'], color: '#d9e2ce' },
  { id: 'builtin-fast-burger', name: '汉堡薯条', category: 'fast', emoji: '🍔', desc: '不用纠结的快乐套餐', tags: ['快捷', '满足'], color: '#ffe09f' },
  { id: 'builtin-fast-pizza', name: '披萨', category: 'fast', emoji: '🍕', desc: '芝士拉丝，一起分享', tags: ['芝士', '分享'], color: '#ffd5a7' },
  { id: 'builtin-fast-dumpling', name: '饺子', category: 'fast', emoji: '🥟', desc: '热气腾腾，一口一个', tags: ['主食', '暖胃'], color: '#e8efcc' },
  { id: 'builtin-fast-rice', name: '咖喱饭', category: 'fast', emoji: '🍛', desc: '浓郁咖喱，拌饭真香', tags: ['主食', '浓香'], color: '#f3d38e' },
  { id: 'builtin-dessert-cake', name: '草莓蛋糕', category: 'dessert', emoji: '🍰', desc: '今天也值得一点甜', tags: ['奶油', '甜蜜'], color: '#ffdce8' },
  { id: 'builtin-dessert-boba', name: '珍珠奶茶', category: 'dessert', emoji: '🧋', desc: '咕噜一口，心情变好', tags: ['饮品', '甜蜜'], color: '#e8d0bd' },
  { id: 'builtin-dessert-ice', name: '冰淇淋', category: 'dessert', emoji: '🍦', desc: '饭后散步的最佳搭档', tags: ['冰爽', '约会'], color: '#d9e9f8' },
  { id: 'builtin-dessert-tangyuan', name: '酒酿圆子', category: 'dessert', emoji: '🥣', desc: '软软糯糯，温柔收尾', tags: ['暖甜', '中式'], color: '#f5e7cf' }
]

function categoryName(id) {
  const item = categories.find(category => category.id === id)
  return item ? item.name : '其他'
}

module.exports = { categories, foods, categoryName }

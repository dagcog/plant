export const PHASES = [
  { id: 'morning', label: '清晨', time: '07:00', light: 59, seconds: 80, note: '晨光刚落到窗台。', icon: 'sunrise' },
  { id: 'noon', label: '正午', time: '12:00', light: 88, seconds: 80, note: '日光落得正亮。', icon: 'sun' },
  { id: 'evening', label: '傍晚', time: '18:00', light: 37, seconds: 80, note: '最后一缕光慢慢褪去。', icon: 'moon' },
];

export const SLOTS = [
  { id: 'left', number: '01', name: '晨光位', offset: 0, price: 0, x: -1.36 },
  { id: 'middle', number: '02', name: '明窗位', offset: 9, price: 0, x: 0 },
  { id: 'right', number: '03', name: '窗影位', offset: -15, price: 48, x: 1.36 },
];

export const SPECIES = {
  chamomile: { name: '洋甘菊', latin: 'Matricaria', model: 'daisy', price: 13, value: 38, seconds: 100,
    ideal: [58, 57, 64], petal: '#fff2cf', center: '#e8a02c', leaf: '#668644', rare: '#f4ae69', rareKey: 'peach_dew', rareName: '蜜桃晨露', detail: '喜欢透亮的日光与微湿的土。' },
  lavender: { name: '薰衣草', latin: 'Lavandula', model: 'spike', price: 18, value: 49, seconds: 125,
    ideal: [43, 60, 76], petal: '#9682c8', center: '#c4a7e7', leaf: '#65846b', rare: '#ffe6ee', rareKey: 'moon_white', rareName: '月白香穗', detail: '偏爱较干的土和充足日光。' },
  oxalis: { name: '紫叶酢浆草', latin: 'Oxalis', model: 'clover', price: 22, value: 56, seconds: 145,
    ideal: [66, 65, 48], petal: '#f3afbc', center: '#ffd383', leaf: '#8c4e77', rare: '#f9d897', rareKey: 'amber_leaf', rareName: '琥珀三叶', detail: '喜欢略湿的土和柔和散射光。' },
};

export const POTS = {
  clay: { name: '赤陶盆', price: 15, color: '#b9684d', rim: '#cf8b6b', drainage: 1.18, detail: '疏水快，适合偏干的品种。' },
  glaze: { name: '苔绿釉盆', price: 22, color: '#6d8769', rim: '#a9b597', drainage: 0.9, detail: '保水适中，釉面温润。' },
  porcelain: { name: '燕麦白瓷', price: 28, color: '#e2caab', rim: '#f6e3c9', drainage: 0.72, detail: '水分散失慢，适合喜湿植物。' },
};

export const EXPOSURES = [
  { name: '柔光', factor: 0.72 }, { name: '自然', factor: 1 }, { name: '补光', factor: 1.24 },
];

export const ACHIEVEMENTS = {
  bloom: { name: '第一朵花', reward: 18, detail: '让一株植物成熟' },
  display: { name: '窗边策展人', reward: 14, detail: '把第一株植物摆上花架' },
  sold: { name: '带花回家', reward: 10, detail: '售出第一株植物' },
  rare: { name: '意外之色', reward: 24, detail: '培育出一株异色植物' },
  full: { name: '满窗皆绿', reward: 10, detail: '解锁全部种植位' },
  collection: { name: '一本花簿', reward: 20, detail: '记录全部品种' },
};

export const SHELF_LIMIT = 8;
export const OFFLINE_CAP = 30 * 60;
export const CYCLE = PHASES.reduce((total, phase) => total + phase.seconds, 0);

export const NEIGHBORS = [
  { id: 'demo-fern', name: '蕨姨的玻璃房', author: '蕨姨 · 示范花架', tone: 'fern', description: '喜欢叶背上的纹路，也喜欢雨停后的味道。', likes: 12,
    plants: [{ species: 'oxalis', pot: 'glaze', rare: false, quality: 91, seed: 628 }, { species: 'lavender', pot: 'porcelain', rare: true, quality: 96, seed: 947 }] },
  { id: 'demo-slow', name: '慢半拍的午后', author: '小杏 · 示范花架', tone: 'peach', description: '一排陶盆，等每一朵花慢慢打开。', likes: 8,
    plants: [{ species: 'chamomile', pot: 'clay', rare: true, quality: 93, seed: 859 }, { species: 'chamomile', pot: 'porcelain', rare: false, quality: 78, seed: 571 }, { species: 'lavender', pot: 'clay', rare: false, quality: 76, seed: 239 }] },
];

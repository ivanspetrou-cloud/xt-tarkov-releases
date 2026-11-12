// Зеркало открытых веб-версий каналов для тех, у кого Telegram заблокирован:
//   «Тарковское Метадвижение» (t.me/s/metadvij) → feed/feed.json — русская версия оверлея XT;
//   «Escape from Tarkov Official» (t.me/s/escapefromtarkovEN, официальный канал BSG) → feed/feed_en.json — английская версия.
// Берётся только то, что оверлей XT и так показывает: заголовок поста, дата, ссылка, промокоды. Запускает .github/workflows/tgfeed.yml.
// Разбор — копия tgParse из app/main.js оверлея: поменяли там — поменять и здесь.
import fs from 'node:fs';
const CHANNELS = [
  { channel: 'metadvij', name: 'Тарковское Метадвижение', out: 'feed/feed.json' },
  { channel: 'escapefromtarkovEN', name: 'Escape from Tarkov Official', out: 'feed/feed_en.json' }
];
function tgParse(html) {
  const dec = s => s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
  const posts = [];
  const re = /data-post="([^"]+)"[\s\S]*?<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<time datetime="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const txt = dec(m[2]).trim(), lines = txt.split('\n').map(s => s.trim()).filter(Boolean);
    // заголовок — первая строка; у пересланных постов строк нет — до конца первого предложения, не длиннее ~110 знаков
    let title = (lines[0] || '').replace(/^[^\p{L}\p{N}«"]+/u, '');
    const cut = title.search(/[.!?…](\s|$)|\s{2,}/); if (cut > 20) title = title.slice(0, cut + 1).replace(/\s+$/, '');
    if (title.length > 110) title = title.slice(0, 108).replace(/\s+\S*$/, '') + '…';
    const codes = [];
    // промокоды: в русском канале — строка с кодом после 🎁 в посте со словом «промокод»; в английском — «promo code», «use code XXX», «redeem»
    const okCode = c => c && /[A-Z]/.test(c) && !/^(EFT|PVE|PVP|BSG|ARENA|TWITCH|EXFIL|USEC|BEAR)$/.test(c) && !codes.some(x => x.code === c);
    // реклама чужих магазинов и игр («промокод на скидку в GGSel») - не игровые коды: такие посты пропускаем,
    // а код ищем только в постах про саму игру (12.11.2026: в ленту попал код скидки на ключи Fragmentary Order)
    const ad = /GGSel|Playerok|Plati\.?market|скидк|при покупке|ключ[иа]? активации|#реклама|\berid\b|discount|sponsored/i.test(txt);
    const game = /Тарков|Tarkov|\bEFT\b|\bPvE\b|\bPvP\b|Battlestate|\bBSG\b|лаунчер|launcher/i.test(txt);
    if (!ad && game && /промо ?код|promo ?code|\bcode\b|redeem/i.test(txt)) for (const ln of lines) {
      const c = /^(?:🎁|🎉|🔑|▪️|•|-)?\s*([A-Z0-9][A-Z0-9_-]{4,30})\b\s*(?:[—–-]\s*(.+))?$/u.exec(ln.replace(/^🎁\s*/u, ''));
      if (c && okCode(c[1])) codes.push({ code: c[1], note: (c[2] || '').slice(0, 60) });
      else for (const k of ln.matchAll(/(?:promo ?code|\bcode|redeem|промо ?код)\s*[:\-—–]?\s*[«"“']?([A-Z0-9][A-Z0-9_-]{4,30})\b/giu))
        if (okCode(k[1]) && k[1] === k[1].toUpperCase()) codes.push({ code: k[1], note: (/\b(PvE|PvP)\b/i.exec(ln) || [''])[0] });
    }
    posts.push({ id: m[1], url: 'https://t.me/' + m[1], date: m[3], title, codes });
  }
  return posts.reverse(); // новые сверху
}

let fails = 0;
for (const C of CHANNELS) {
  try {
    const r = await fetch('https://t.me/s/' + C.channel, { headers: { 'User-Agent': 'Mozilla/5.0 xt-tarkov-overlay-feed' }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const posts = tgParse(await r.text());
    if (!posts.length) throw new Error('постов не найдено — разметка t.me изменилась?');
    const old = fs.existsSync(C.out) ? JSON.parse(fs.readFileSync(C.out, 'utf8')) : null;
    if (old && JSON.stringify(old.posts) === JSON.stringify(posts)) { console.log(C.channel, 'без изменений'); continue; }
    fs.writeFileSync(C.out, JSON.stringify({ t: Date.now(), channel: C.channel, name: C.name, posts }, null, 1) + '\n');
    console.log(C.channel, 'постов', posts.length);
  } catch (e) { fails++; console.error(C.channel, e.message || e); }
}
if (fails === CHANNELS.length) process.exit(1);

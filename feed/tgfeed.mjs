// Зеркало открытой веб-версии канала «Тарковское Метадвижение» (t.me/s/metadvij) для тех, у кого Telegram заблокирован.
// Берётся только то, что оверлей XT и так показывает: заголовок поста, дата, ссылка, промокоды. Запускает .github/workflows/tgfeed.yml.
import fs from 'node:fs';
const TG_CHANNEL = 'metadvij';
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
    if (/промо ?код/i.test(txt)) for (const ln of lines) {
      const c = /^(?:🎁|🎉|🔑|▪️|•|-)?\s*([A-Z0-9][A-Z0-9_-]{4,30})\b\s*(?:[—–-]\s*(.+))?$/u.exec(ln.replace(/^🎁\s*/u, ''));
      if (c && /[A-Z]/.test(c[1]) && !/^(EFT|PVE|PVP|BSG)$/.test(c[1])) codes.push({ code: c[1], note: (c[2] || '').slice(0, 60) });
    }
    posts.push({ id: m[1], url: 'https://t.me/' + m[1], date: m[3], title, codes });
  }
  return posts.reverse(); // новые сверху
}

const r = await fetch('https://t.me/s/' + TG_CHANNEL, { headers: { 'User-Agent': 'Mozilla/5.0 xt-tarkov-overlay-feed' }, signal: AbortSignal.timeout(20000) });
if (!r.ok) throw new Error('HTTP ' + r.status);
const posts = tgParse(await r.text());
if (!posts.length) throw new Error('постов не найдено — разметка t.me изменилась?');
const out = 'feed/feed.json', old = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : null;
if (old && JSON.stringify(old.posts) === JSON.stringify(posts)) { console.log('без изменений'); process.exit(0); }
fs.writeFileSync(out, JSON.stringify({ t: Date.now(), channel: TG_CHANNEL, name: 'Тарковское Метадвижение', posts }, null, 1) + '\n');
console.log('постов', posts.length);

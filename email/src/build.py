import json
B="https://k13projects.com/email/"
# The email line can carry either address (Kazim, 2026-10-13). Signatures are built with the first;
# the page and the War Room swap it for the one picked, in the preview and in what Copy puts out.
ADDRS=["projects.k13@gmail.com","kazim@k13projects.com"]
INK="#1F2023";MUT="#5D5F65";OR="#B94612";F="font-family:Arial,Helvetica,sans-serif;"
T='<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;'
def a(href,text,col=INK): return f'<a href="{href}" target="_blank" style="color:{col};text-decoration:none;white-space:nowrap;"><span style="color:{col};text-decoration:none;white-space:nowrap;">{text}</span></a>'
LOGO=f'<a href="https://k13projects.com" target="_blank" style="text-decoration:none;"><img src="{B}k13-signature-logo.png" width="96" height="63" alt="K13 Software Studio" style="display:block;width:96px;height:63px;max-width:96px;border:0;outline:none;text-decoration:none;"></a>'
MARK=f'<a href="https://k13projects.com" target="_blank" style="text-decoration:none;"><img src="{B}k13-signature-mark.png" width="54" height="26" alt="K13" style="display:block;width:54px;height:26px;max-width:54px;border:0;outline:none;text-decoration:none;"></a>'
def ico(n,alt): return f'<img src="{B}k13-icon-{n}.png" width="16" height="16" alt="{alt}" style="display:block;width:16px;height:16px;border:0;outline:none;">'
def icol(n,alt): return f'<img src="{B}k13-icon-{n}.png" width="13" height="13" alt="{alt}" style="display:inline-block;width:13px;height:13px;border:0;outline:none;vertical-align:-2px;">&nbsp;'
def crow(l,text,href): return (f'<tr><td style="padding:0 0 4px 0;">{T}"><tr><td width="24" valign="middle" style="width:24px;line-height:0;">{ico(l,{"phone":"Phone","mail":"Email","web":"Web"}[l])}</td>'
    f'<td style="{F}font-size:13px;line-height:18px;color:{INK};">{a(href,text)}</td></tr></table></td></tr>')
PH=a("tel:+19493066998","+1 949 306 6998");EM=a("mailto:"+ADDRS[0],ADDRS[0]);WB=a("https://k13projects.com","k13projects.com")
DOT=f'<span style="color:{OR};">&nbsp;&middot;&nbsp;</span>'
V=[]
# 0 the full one
V.append(("K13SS new","The full one, for first contact and new clients.",f'''{T}{F}max-width:360px;">
<tr><td style="padding:0 0 12px 0;">{LOGO}</td></tr>
<tr><td style="padding:0 0 10px 0;">{T}"><tr><td width="36" height="2" style="width:36px;height:2px;background-color:{OR};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
<tr><td style="padding:0;{F}font-size:16px;line-height:22px;font-weight:bold;color:{INK};">Kazim An&#305;l Korkmaz</td></tr>
<tr><td style="padding:0 0 10px 0;{F}font-size:13px;line-height:18px;color:{MUT};">Founder &middot; K13 Software Studio</td></tr>
{crow("phone","+1 949 306 6998","tel:+19493066998")}{crow("mail",ADDRS[0],"mailto:"+ADDRS[0])}{crow("web","k13projects.com","https://k13projects.com")}
<tr><td style="padding:10px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:18px;font-style:italic;color:{OR};">Software that feels obvious.</td></tr>
</table>'''))
# 1 compact: mark beside name, one contact line
V.append(("K13SS compact","Regular clients: the logo, your name, and one line to reach you.",f'''{T}{F}">
<tr><td valign="middle" style="padding:0 12px 0 0;border-right:2px solid {OR};">{MARK}</td>
<td valign="middle" style="padding:0 0 0 12px;">{T}">
<tr><td style="{F}font-size:14px;line-height:19px;font-weight:bold;color:{INK};">Kazim An&#305;l Korkmaz</td></tr>
<tr><td style="{F}font-size:12px;line-height:17px;color:{MUT};white-space:nowrap;">K13 Software Studio</td></tr><tr><td style="{F}font-size:12px;line-height:17px;color:{INK};white-space:nowrap;">{icol("phone","Phone")}{PH}&nbsp;&nbsp;&nbsp;{icol("web","Web")}{WB}</td></tr></table></td></tr></table>'''))
# 2 inline: one line, small mark
V.append(("K13SS inline","One line for everyday threads.",f'''{T}{F}">
<tr><td valign="middle" style="padding:0 10px 0 0;">{MARK}</td>
<td valign="middle" style="{F}font-size:13px;line-height:18px;color:{INK};"><b style="color:{INK};">Kazim</b>{DOT}<span style="color:{MUT};">K13 Software Studio</span>&nbsp;&nbsp;&nbsp;{icol("web","Web")}{WB}</td></tr></table>'''))
# 3 first name, warm
V.append(("K13SS mini","Close collaborators: just your name and the line.",f'''{T}{F}">
<tr><td style="{F}font-size:14px;line-height:20px;font-weight:bold;color:{INK};">Kazim</td></tr>
<tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:18px;font-style:italic;color:{OR};">K13 &middot; Software that feels obvious.</td></tr></table>'''))
# 4 text only, no image at all
V.append(("K13SS text","Text only, no image: safe anywhere, perfect for replies and phones.",f'''{T}{F}">
<tr><td style="{F}font-size:13px;line-height:19px;color:{INK};">Kazim An&#305;l Korkmaz<span style="color:{OR};">&nbsp;|&nbsp;</span>K13 Software Studio<br>{PH}<span style="color:{OR};">&nbsp;|&nbsp;</span>{WB}</td></tr></table>'''))
import re
def dark(h): return h.replace("color:"+INK,"color:#E8EAF0").replace("color:"+MUT,"color:#B4B5B9")
# One design, three mail apps. Gmail and Apple Mail both paste into a WebKit/Blink editor and keep
# the code as it is. Outlook for Windows draws mail with Word, which needs four things spelled out:
# exact line heights (else Word pads every line), the orange rule as a bgcolor cell with a real
# 2px font (an empty 0px cell grows to a full text line), no negative vertical-align on the small
# icons, and no exact line height on a cell that holds a picture (Word clips the picture).
def outlook(h):
    h=re.sub(r'line-height:(\d+)px',r'mso-line-height-rule:exactly;line-height:\1px',h)
    h=h.replace(f'style="width:36px;height:2px;background-color:{OR};font-size:0;line-height:0;"',
                f'bgcolor="{OR}" style="width:36px;height:2px;background-color:{OR};font-size:2px;mso-line-height-rule:exactly;line-height:2px;"')
    return h.replace("vertical-align:-2px;","vertical-align:middle;")
APPS={
 "gmail":("Gmail",lambda h:h,[
  "Gmail &rarr; Settings (the gear) &rarr; See all settings &rarr; General &rarr; Signature.",
  "Create new, give it the name shown on the card (K13SS new, K13SS compact...), click into the box, press Cmd+V.",
  "Under Signature defaults pick one for new emails and one for replies (suggested: K13SS new and K13SS inline). Save Changes at the bottom.",
  "While writing any email, the pen icon in the bottom bar switches signatures."]),
 "apple":("Apple Mail",lambda h:h,[
  "Copy with the Copy button on this page, in Chrome. Do not select the signature with the mouse, and do not copy from Safari: Safari's copy enlarges the logo.",
  "Mail &rarr; Settings (Cmd+,) &rarr; Signatures. Pick the account on the left, press + and name it as on the card (K13SS new...).",
  "<b>Before pasting</b>, untick &ldquo;Always match my default message font&rdquo; under the box. Left ticked, Mail rewrites the fonts and colours.",
  "Click into the box on the right, press Cmd+A then Delete to clear Mail's default text, then Cmd+V.",
  "The logo can show as a blue question mark inside Settings. That is normal: close Settings, open a new email and it is there.",
  "Pick the default under the box with &ldquo;Choose Signature&rdquo;. In Settings &rarr; Composing, Message format must be Rich Text.",
  "iPhone Mail drops pictures from a pasted signature: use K13SS text there."]),
 "outlook":("Outlook",outlook,[
  "Copy with the Copy button on this page (the Outlook version, picked above: it carries the extra code Outlook for Windows needs).",
  "Outlook on Mac, new Outlook on Windows and outlook.com: Settings &rarr; Signatures (on the web: Settings &rarr; Account &rarr; Signatures). Classic Outlook on Windows: File &rarr; Options &rarr; Mail &rarr; Signatures.",
  "Press + (or New), name it as on the card, click into the box and press Cmd+V (Ctrl+V on Windows).",
  "If the text turns plain after pasting, click the small clipboard icon that appears beside it and choose &ldquo;Keep Source Formatting&rdquo;.",
  "Set the defaults for new messages and for replies (suggested: K13SS new and K13SS inline), then Save.",
  "Classic Outlook stores the logo inside the signature, so it shows without &ldquo;download pictures&rdquo;. That is expected."]),
}
cards=""
for i,(name,why,h) in enumerate(V):
    cards+=f'''<section class="v"><div class="hd"><span class="n">{i if i else "Main"}</span><h2>{name}</h2><p>{why}</p><button type="button" data-i="{i}">Copy for <span class="an">Gmail</span></button><span class="ok" id="ok{i}"></span></div>
<div class="g"><div class="c l">{h}</div><div class="c d">{dark(h)}</div></div></section>'''
tabs="".join(f'<button type="button" class="ap{" on" if k=="gmail" else ""}" data-app="{k}" aria-pressed="{"true" if k=="gmail" else "false"}">{lab}</button>' for k,(lab,_,_) in APPS.items())
addrs="".join(f'<button type="button" class="ap ad{" on" if i==0 else ""}" data-addr="{x}" aria-pressed="{"true" if i==0 else "false"}">{x}</button>' for i,x in enumerate(ADDRS))
steps="".join(f'<ol class="st" data-app="{k}"{"" if k=="gmail" else " hidden"}>'+"".join(f"<li>{s}</li>" for s in st)+"</ol>" for k,(_,_,st) in APPS.items())
page=f'''<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>K13 Email Signatures</title>
<style>body{{margin:0;background:#F3F5FA;font-family:system-ui,-apple-system,sans-serif;color:#1F2023}}.w{{max-width:900px;margin:0 auto;padding:32px 20px 48px}}
h1{{font:600 28px Georgia,serif;margin:0 0 6px}}p.s{{color:#5D5F65;margin:0 0 18px}}
.apps{{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 18px}}.ap{{font:600 14px system-ui;background:#fff;color:#1F2023;border:1px solid #DDE3EF;border-radius:999px;padding:8px 16px;cursor:pointer}}.ap.on{{background:#1F2023;color:#fff;border-color:#1F2023}}.lb{{font:600 12px system-ui;color:#5D5F65;align-self:center;margin-right:4px}}
.how{{background:#fff;border:1px solid #DDE3EF;border-radius:16px;padding:6px 18px;margin-bottom:16px}}.how h2{{font:600 15px system-ui;margin:12px 0 0}}
.v{{background:#fff;border:1px solid #DDE3EF;border-radius:16px;padding:18px;margin-bottom:16px}}
.hd{{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}}.hd h2{{font:600 17px system-ui;margin:0}}.hd p{{margin:0;color:#5D5F65;font-size:14px;flex:1;min-width:200px}}
.n{{font:600 11px ui-monospace,monospace;letter-spacing:.1em;color:#fff;background:#1F2023;border-radius:999px;padding:4px 9px}}
button[data-i]{{font:600 14px system-ui;background:#B94612;color:#fff;border:0;border-radius:9px;padding:9px 16px;cursor:pointer;white-space:nowrap}}.ok{{color:#1aa66b;font-weight:600;font-size:13px}}
.g{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}.c{{border-radius:12px;padding:20px}}.c.l{{background:#fff;border:1px solid #E6EAF2}}.c.d{{background:#202124}}
ol{{line-height:1.7;color:#3A3C40}}@media(max-width:700px){{.g{{grid-template-columns:1fr}}}}</style></head><body><div class="w">
<h1>K13 email signatures</h1><p class="s">Five signatures, from the full one to plain text, each shown on a light and a dark inbox. Pick your mail app, then Copy puts the right version on your clipboard.</p>
<div class="apps" role="group" aria-label="Mail app">{tabs}</div>
<div class="apps" role="group" aria-label="Email address"><span class="lb">Email on the signature</span>{addrs}</div>
<div class="how"><h2>Set it up in <span class="an">Gmail</span></h2>{steps}</div>
{cards}</div>
<script>const SIGS={json.dumps([h for _,_,h in V])};
const SIGS_APPLE={json.dumps([APPS["apple"][1](h) for _,_,h in V])};
const SIGS_OUTLOOK={json.dumps([outlook(h) for _,_,h in V])};
const ADDRS={json.dumps(ADDRS)};let addr=ADDRS[0];const swap=h=>h.split(ADDRS[0]).join(addr);
const BY={{gmail:SIGS,apple:SIGS_APPLE,outlook:SIGS_OUTLOOK}},LAB={json.dumps({k:v[0] for k,v in APPS.items()})};let app='gmail';
try{{const s=localStorage.getItem('k13sigapp');if(BY[s])app=s;const d=localStorage.getItem('k13sigaddr');if(ADDRS.includes(d))addr=d;}}catch(e){{}}
const PREV=[...document.querySelectorAll('.c')].map(c=>c.innerHTML);
function setAddr(x){{addr=x;document.querySelectorAll('.ad').forEach(b=>{{const on=b.dataset.addr===x;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)}});
document.querySelectorAll('.c').forEach((c,i)=>c.innerHTML=swap(PREV[i]));try{{localStorage.setItem('k13sigaddr',x)}}catch(e){{}}}}
function setApp(a){{app=a;document.querySelectorAll('.ap[data-app]').forEach(b=>{{const on=b.dataset.app===a;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)}});
document.querySelectorAll('ol.st').forEach(o=>o.hidden=o.dataset.app!==a);document.querySelectorAll('.an').forEach(s=>s.textContent=LAB[a]);try{{localStorage.setItem('k13sigapp',a)}}catch(e){{}}}}
document.querySelectorAll('.ap[data-app]').forEach(b=>b.onclick=()=>setApp(b.dataset.app));setApp(app);
document.querySelectorAll('.ad').forEach(b=>b.onclick=()=>setAddr(b.dataset.addr));setAddr(addr);
document.querySelectorAll('button[data-i]').forEach(b=>b.onclick=async()=>{{const i=+b.dataset.i,h=swap(BY[app][i]),t=new DOMParser().parseFromString(h,'text/html').body.innerText;
try{{await navigator.clipboard.write([new ClipboardItem({{'text/html':new Blob([h],{{type:'text/html'}}),'text/plain':new Blob([t],{{type:'text/plain'}})}})]);}}
catch(e){{const d=document.createElement('div');d.innerHTML=h;document.body.appendChild(d);const r=document.createRange();r.selectNodeContents(d);const s=getSelection();s.removeAllRanges();s.addRange(r);document.execCommand('copy');s.removeAllRanges();d.remove();}}
document.getElementById('ok'+i).textContent='Copied for '+LAB[app];setTimeout(()=>document.getElementById('ok'+i).textContent='',2500);}});
/* (runs after setAddr rebuilt the previews) preview only: until the images are live on k13projects.com, show the local copies; copied signatures always point at the live URLs */
document.querySelectorAll('img').forEach(i=>{{const f=i.getAttribute('src').split('/').pop();i.onerror=()=>{{i.onerror=null;i.src=f}}}});</script></body></html>'''
open('../index.html','w').write(page)  # run from email/src

print('ok',len(V))

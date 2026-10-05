import json
B="https://k13projects.com/email/"
INK="#1F2023";MUT="#5D5F65";OR="#B94612";F="font-family:Arial,Helvetica,sans-serif;"
T='<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;'
def a(href,text,col=INK): return f'<a href="{href}" target="_blank" style="color:{col};text-decoration:none;white-space:nowrap;"><span style="color:{col};text-decoration:none;white-space:nowrap;">{text}</span></a>'
LOGO=f'<a href="https://k13projects.com" target="_blank" style="text-decoration:none;"><img src="{B}k13-signature-logo.png" width="96" height="63" alt="K13 Software Studio" style="display:block;width:96px;height:63px;max-width:96px;border:0;outline:none;text-decoration:none;"></a>'
MARK=f'<a href="https://k13projects.com" target="_blank" style="text-decoration:none;"><img src="{B}k13-signature-mark.png" width="54" height="26" alt="K13" style="display:block;width:54px;height:26px;max-width:54px;border:0;outline:none;text-decoration:none;"></a>'
def ico(n,alt): return f'<img src="{B}k13-icon-{n}.png" width="16" height="16" alt="{alt}" style="display:block;width:16px;height:16px;border:0;outline:none;">'
def icol(n,alt): return f'<img src="{B}k13-icon-{n}.png" width="13" height="13" alt="{alt}" style="display:inline-block;width:13px;height:13px;border:0;outline:none;vertical-align:-2px;">&nbsp;'
def crow(l,text,href): return (f'<tr><td style="padding:0 0 4px 0;">{T}"><tr><td width="24" valign="middle" style="width:24px;line-height:0;">{ico(l,{"phone":"Phone","mail":"Email","web":"Web"}[l])}</td>'
    f'<td style="{F}font-size:13px;line-height:18px;color:{INK};">{a(href,text)}</td></tr></table></td></tr>')
PH=a("tel:+19493066998","+1 949 306 6998");EM=a("mailto:projects.k13@gmail.com","projects.k13@gmail.com");WB=a("https://k13projects.com","k13projects.com")
DOT=f'<span style="color:{OR};">&nbsp;&middot;&nbsp;</span>'
V=[]
# 0 the full one
V.append(("K13SS new","The full one, for first contact and new clients.",f'''{T}{F}max-width:360px;">
<tr><td style="padding:0 0 12px 0;">{LOGO}</td></tr>
<tr><td style="padding:0 0 10px 0;">{T}"><tr><td width="36" height="2" style="width:36px;height:2px;background-color:{OR};font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
<tr><td style="padding:0;{F}font-size:16px;line-height:22px;font-weight:bold;color:{INK};">Kazim An&#305;l Korkmaz</td></tr>
<tr><td style="padding:0 0 10px 0;{F}font-size:13px;line-height:18px;color:{MUT};">Founder &middot; K13 Software Studio</td></tr>
{crow("phone","+1 949 306 6998","tel:+19493066998")}{crow("mail","projects.k13@gmail.com","mailto:projects.k13@gmail.com")}{crow("web","k13projects.com","https://k13projects.com")}
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
def dark(h): return h.replace("color:"+INK,"color:#E8EAF0").replace("color:"+MUT,"color:#B4B5B9")
cards=""
for i,(name,why,h) in enumerate(V):
    cards+=f'''<section class="v"><div class="hd"><span class="n">{i if i else "Main"}</span><h2>{name}</h2><p>{why}</p><button type="button" data-i="{i}">Copy</button><span class="ok" id="ok{i}"></span></div>
<div class="g"><div class="c l">{h}</div><div class="c d">{dark(h)}</div></div></section>'''
page=f'''<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>K13 Gmail Signatures</title>
<style>body{{margin:0;background:#F3F5FA;font-family:system-ui,-apple-system,sans-serif;color:#1F2023}}.w{{max-width:900px;margin:0 auto;padding:32px 20px 48px}}
h1{{font:600 28px Georgia,serif;margin:0 0 6px}}p.s{{color:#5D5F65;margin:0 0 26px}}
.v{{background:#fff;border:1px solid #DDE3EF;border-radius:16px;padding:18px;margin-bottom:16px}}
.hd{{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}}.hd h2{{font:600 17px system-ui;margin:0}}.hd p{{margin:0;color:#5D5F65;font-size:14px;flex:1;min-width:200px}}
.n{{font:600 11px ui-monospace,monospace;letter-spacing:.1em;color:#fff;background:#1F2023;border-radius:999px;padding:4px 9px}}
button{{font:600 14px system-ui;background:#B94612;color:#fff;border:0;border-radius:9px;padding:9px 16px;cursor:pointer}}.ok{{color:#1aa66b;font-weight:600;font-size:13px}}
.g{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}.c{{border-radius:12px;padding:20px}}.c.l{{background:#fff;border:1px solid #E6EAF2}}.c.d{{background:#202124}}
ol{{line-height:1.7;color:#3A3C40}}@media(max-width:700px){{.g{{grid-template-columns:1fr}}}}</style></head><body><div class="w">
<h1>K13 Gmail signatures</h1><p class="s">Five signatures, from the full one to plain text. Each shown on a light and a dark inbox; Copy puts it on your clipboard ready for Gmail.</p>
{cards}
<ol><li>Gmail &rarr; Settings &rarr; See all settings &rarr; General &rarr; Signature.</li><li>Create new, give it the name shown above (K13SS new, K13SS compact...), click into the box, press Cmd+V.</li>
<li>Repeat for any others you want. Under "Signature defaults" pick one for new emails and one for replies (e.g. new: K13SS new, replies: K13SS inline). Save Changes at the bottom.</li>
<li>While writing any email, the pen icon in the bottom bar switches signatures.</li></ol></div>
<script>const SIGS={json.dumps([h for _,_,h in V])};
document.querySelectorAll('button[data-i]').forEach(b=>b.onclick=async()=>{{const i=+b.dataset.i,h=SIGS[i],t=new DOMParser().parseFromString(h,'text/html').body.innerText;
try{{await navigator.clipboard.write([new ClipboardItem({{'text/html':new Blob([h],{{type:'text/html'}}),'text/plain':new Blob([t],{{type:'text/plain'}})}})]);}}
catch(e){{const d=document.createElement('div');d.innerHTML=h;document.body.appendChild(d);const r=document.createRange();r.selectNodeContents(d);const s=getSelection();s.removeAllRanges();s.addRange(r);document.execCommand('copy');s.removeAllRanges();d.remove();}}
document.getElementById('ok'+i).textContent='Copied';setTimeout(()=>document.getElementById('ok'+i).textContent='',2500);}});
/* preview only: until the images are live on k13projects.com, show the local copies; copied signatures always point at the live URLs */
document.querySelectorAll('img').forEach(i=>{{const f=i.getAttribute('src').split('/').pop();i.onerror=()=>{{i.onerror=null;i.src=f}}}});</script></body></html>'''
open('../index.html','w').write(page)  # run from email/src

print('ok',len(V))

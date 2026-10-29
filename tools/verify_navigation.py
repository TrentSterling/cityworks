"""Synthetic browser input only; exercises viewport navigation and form isolation."""
from pathlib import Path
import argparse,functools,http.server,json,math,threading
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--url');args=parser.parse_args()
OUT=ROOT/'artifacts/navigation';OUT.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
url=args.url or f'http://127.0.0.1:{server.server_port}/'
report={'url':url,'checks':[],'errors':[]}
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True,args=['--mute-audio','--use-angle=d3d11','--no-first-run','--disable-background-networking'])
 page=browser.new_page(viewport={'width':1500,'height':1000});page.on('pageerror',lambda e:report['errors'].append(str(e)))
 try:
  page.goto(url);page.wait_for_function('window.Integration?.ready',timeout=90000);page.evaluate("Integration.setView('street')")
  pose=lambda:page.evaluate('Integration.camera.position.toArray()')
  assert page.evaluate('Integration.navigation.mode')=='fly'
  page.mouse.move(800,500);page.mouse.down(button='right');q=page.evaluate('Integration.camera.quaternion.toArray()');page.mouse.move(900,530,steps=5);page.mouse.up(button='right')
  assert page.evaluate('Integration.camera.quaternion.toArray()')!=q and not page.evaluate('Integration.navigation.looking')
  a=pose();page.keyboard.down('w');page.wait_for_timeout(350);assert abs(page.evaluate('Integration.navigation.inspect().speed')-16)<.001;page.keyboard.up('w');b=pose();assert math.dist(a,b)>.25
  page.wait_for_timeout(100);assert math.dist(b,pose())<.001
  page.keyboard.down('w');page.keyboard.down('d');page.wait_for_timeout(150);assert abs(page.evaluate('Integration.navigation.inspect().speed')-16)<.001
  page.keyboard.down('Shift');page.wait_for_timeout(100);assert abs(page.evaluate('Integration.navigation.inspect().speed')-48)<.001
  page.keyboard.up('Shift');page.keyboard.up('w');page.keyboard.up('d')
  page.keyboard.down('e');page.wait_for_timeout(150);page.keyboard.press('Escape');a=pose();page.wait_for_timeout(100);assert math.dist(a,pose())<.001;page.keyboard.up('e')
  page.keyboard.down('w');page.mouse.down(button='right');page.evaluate("dispatchEvent(new Event('blur'))");assert page.evaluate('Integration.navigation.inspect()')=={'mode':'fly','looking':False,'keys':[],'speed':0};page.keyboard.up('w');page.mouse.up(button='right')
  report['checks'].append('WASD, normalized diagonal, sprint, held RMB, Q/E, release, Escape and blur')
  page.keyboard.down('w');page.keyboard.press('Escape');a=pose()
  page.evaluate("dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',repeat:true,bubbles:true}))");page.wait_for_timeout(150);assert math.dist(a,pose())<.001 and not page.evaluate('Integration.navigation.keys.size');page.keyboard.up('w')
  for editable in ['', 'plaintext-only', 'inherited']:
   page.evaluate("value=>{const el=document.createElement('div');el.id='typing-probe';el.setAttribute('contenteditable',value==='inherited'?'':value);document.body.append(el);if(value==='inherited'){const child=document.createElement('span');child.tabIndex=0;el.append(child);child.focus();}else el.focus();}",editable)
   a=pose();page.keyboard.type('wasdqe');page.wait_for_timeout(100);assert math.dist(a,pose())<.001;page.evaluate("document.querySelector('#typing-probe').remove()")
  report['checks'].append('Escape ignores held-key repeats until a fresh press; inherited and plaintext editable fields isolate typing')
  page.locator('#seed').focus();a=pose();page.keyboard.type('wasdqe');page.wait_for_timeout(150);assert math.dist(a,pose())<.001
  assert page.evaluate("(()=>{const e=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});document.querySelector('#seed').dispatchEvent(e);return !e.defaultPrevented})()")
  page.locator('#navigation-mode').click();a=pose();page.keyboard.down('w');page.wait_for_timeout(100);page.keyboard.up('w');assert math.dist(a,pose())<.001 and page.evaluate('Integration.navigation.mode')=='orbit'
  page.locator('#navigation-mode').click();page.screenshot(path=str(OUT/'city.png'));report['checks'].append('text input isolation, viewport-only context handling and optional orbit')
  page.goto(url+'experiments/scoped-editor/');page.wait_for_function('window.MassingEditor && !MassingEditor.busy && MassingEditor.api()?.ready',timeout=100000)
  frame=page.frame_locator('#preview');canvas=frame.locator('canvas');box=canvas.bounding_box();page.mouse.move(box['x']+box['width']*.6,box['y']+box['height']*.5);page.mouse.down(button='right');page.mouse.move(box['x']+box['width']*.6+45,box['y']+box['height']*.5+10);page.mouse.up(button='right')
  pose=lambda:page.evaluate('MassingEditor.api().camera.position.toArray()')
  a=pose();page.keyboard.down('w');page.wait_for_timeout(250);page.keyboard.up('w');assert math.dist(a,pose())>.1
  page.keyboard.down('w');page.locator('#height').focus();a=pose();page.keyboard.type('12');page.wait_for_timeout(150);assert math.dist(a,pose())<.001 and not page.evaluate('MassingEditor.api().navigation.keys.size');page.keyboard.up('w')
  page.locator('#navigation-mode').click();assert page.evaluate('MassingEditor.api().navigation.mode')=='orbit'
  saved=page.evaluate('MassingEditor.api().inspect()');quaternion=page.evaluate('MassingEditor.api().camera.quaternion.toArray()')
  def assert_pose():
   current=page.evaluate('MassingEditor.api().inspect()');q=page.evaluate('MassingEditor.api().camera.quaternion.toArray()')
   assert current['navigationMode']=='orbit' and math.dist(saved['camera'],current['camera'])<.00001 and math.dist(saved['target'],current['target'])<.00001
   assert abs(sum(a*b for a,b in zip(quaternion,q)))>1-1e-8
  page.locator('#reroll').click();page.wait_for_function('!MassingEditor.busy && MassingEditor.api()?.ready',timeout=100000);assert_pose()
  page.locator('#undo').click();page.wait_for_function('!MassingEditor.busy && MassingEditor.api()?.ready',timeout=100000)
  assert_pose();page.locator('#navigation-mode').click()
  page.screenshot(path=str(OUT/'editor.png'));report['checks'].append('iframe input cleanup on parent focus and camera/mode preserved across reroll and undo')
  assert not report['errors'];report['status']='passed';print(json.dumps(report,indent=2))
 except Exception as e:
  report.update(status='failed',exception=str(e));page.screenshot(path=str(OUT/'failure.png'));raise
 finally:
  (OUT/'report.json').write_text(json.dumps(report,indent=2));browser.close();server.shutdown();server.server_close()

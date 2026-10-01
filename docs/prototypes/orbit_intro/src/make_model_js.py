# film.html loads the figure from model.js (base64, so it works over file://). Rebuild it with:  python3 make_model_js.py
import base64
open('model.js','w').write('window.MODEL_B64="'+base64.b64encode(open('fig_final.glb','rb').read()).decode()+'";window.MODEL_YAW=0;window.MODEL_SINK=0.004;')

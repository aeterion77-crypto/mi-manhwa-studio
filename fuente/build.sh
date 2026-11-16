#!/bin/sh
cd "$(dirname "$0")"
python3 - <<'PY'
import glob
shell=open('src/shell.html').read()
css=open('src/style.css').read()
js='\n'.join(open(f).read() for f in sorted(glob.glob('src/[0-9]*.js')))
out=shell.replace('/*CSS*/',css).replace('/*JS*/',js)
open('dist/index.html','w').write(out)
open('dist/app.js','w').write(js)
print(len(out))
PY

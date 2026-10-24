# -*- coding: utf-8 -*-
"""组装提示词:core + pages/*.txt → prompt-*.txt"""
import io, sys, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
core = open('core-style.txt', encoding='utf-8').read()
n = 0
for f in sorted(os.listdir('pages')):
    if not f.endswith('.txt'): continue
    name = f[:-4]
    body = open('pages/' + f, encoding='utf-8').read()
    open('prompt-%s.txt' % name, 'w', encoding='utf-8').write(core + '\n【本页内容】\n' + body)
    n += 1
print('prompts:', n)

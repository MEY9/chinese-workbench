# -*- coding: utf-8 -*-
"""M1 功能大补丁:课堂/档案入口 + F10 点名 + F12 背诵 + F29 档案 + F33 组件"""
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
src = open('app.js', encoding='utf-8').read()
n0 = len(src)

def rep(old, new, cnt=1):
    global src
    assert src.count(old) == cnt, 'anchor x%d (期望%d): %s' % (src.count(old), cnt, old[:70])
    src = src.replace(old, new)

rep("['resources','资料与打印','M5 9V3h14v6M5 18H3v-7h18v7h-2m-14 0v3h14v-3z']",
    "['classroom','课堂','M4 13a8 8 0 0 1 16 0'],['resources','资料与打印','M5 9V3h14v6M5 18H3v-7h18v7h-2m-14 0v3h14v-3z']")
rep("['classes','班级','M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9-1a3 3 0 1 0 0-6m-14 16v-3a5 5 0 0 1 10 0v3zm12 0v-3a4 4 0 0 0-2-3.5']",
    "['profile','档案','M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9-1a3 3 0 1 0 0-6m-14 16v-3a5 5 0 0 1 10 0v3zm12 0v-3a4 4 0 0 0-2-3.5'],['classes','班级','M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9-1a3 3 0 1 0 0-6m-14 16v-3a5 5 0 0 1 10 0v3zm12 0v-3a4 4 0 0 0-2-3.5']")
rep("case'resources':body=renderResources();break;case'pdf':body=renderPdfReader();break;",
    "case'resources':body=renderResources();break;case'pdf':body=renderPdfReader();break;case'classroom':body=renderClassroom();break;case'rollcall':body=renderRollcall();break;case'recite':body=renderRecite();break;case'profile':body=renderProfile();break;")
rep("pdfUrl:null,pdfBookId:null,pdfTemporary:false,pdfFileName:'',",
    "pdfUrl:null,pdfBookId:null,pdfTemporary:false,pdfFileName:'',rollMode:'random',rollPicked:[],rollCurrent:null,rollSeq:0,reciteText:'',reciteGaps:[],reciteDensity:'标准',reciteCur:0,reciteHints:0,profileStudent:null,")

NEW = open('patch_m1_body.js', encoding='utf-8').read()
rep("function renderClasses(){", NEW + "\nfunction renderClasses(){")
open('app.js', 'w', encoding='utf-8').write(src)
print('patch A done:', n0, '->', len(src))

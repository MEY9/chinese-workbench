# -*- coding: utf-8 -*-
"""build.py 增补:PDF.js UMD 内联(消灭运行时加载失败)"""
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
src = open('build.py', encoding='utf-8').read()

old = """    catalog = inline_json(manifest["books"])
    output = (
        template.replace("__CSS__", css)
        .replace("__JS__", js)
        .replace("__BANK__", inline_json(bank))
        .replace("__TEXTBOOKS__", catalog)
    )"""
new = """    catalog = inline_json(manifest["books"])
    # PDF.js 引擎内联(v3 UMD):消灭运行时加载失败(file:// 与 http 均零依赖)
    pdfjs_dir = ROOT / "vendor" / "pdfjs"
    pdfjs_lib = (pdfjs_dir / "pdf.min.js").read_text(encoding="utf-8")
    pdfjs_worker = (pdfjs_dir / "pdf.worker.min.js").read_text(encoding="utf-8")
    # 防止内联 JS 中的 </script 提前闭合标签(字符串/正则内 \\/ 语义等价)
    pdfjs_lib = pdfjs_lib.replace("</script", "<\\\\/script")
    pdfjs_worker = pdfjs_worker.replace("</script", "<\\\\/script")
    output = (
        template.replace("__CSS__", css)
        .replace("__JS__", js)
        .replace("__BANK__", inline_json(bank))
        .replace("__TEXTBOOKS__", catalog)
        .replace("<!--PDFJS_LIB-->", "<script>" + pdfjs_lib + "</script>")
        .replace("<!--PDFJS_WORKER-->", "<script>" + pdfjs_worker + "</script>")
    )"""
assert src.count(old) == 1, 'build.py anchor miss'
src = src.replace(old, new)

# 未解析占位符检查需包含新 token
old2 = 'if any(token in output for token in ("__CSS__", "__JS__", "__BANK__", "__TEXTBOOKS__")):'
new2 = 'if any(token in output for token in ("__CSS__", "__JS__", "__BANK__", "__TEXTBOOKS__", "PDFJS_LIB", "PDFJS_WORKER")):'
assert src.count(old2) == 1
src = src.replace(old2, new2)
open('build.py', 'w', encoding='utf-8').write(src)
print('build.py updated')

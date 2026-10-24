# 教材 PDF 存放处

用户后续提供文件后，逐本核对出版社、年级、册别与版本年份。复制 [entry.example.json](entry.example.json) 为每本教材的 UTF-8 元数据文件并填写；`pdf` 可为绝对路径或相对该元数据文件的路径。`pageCount` 和 `lessons` 仅在人工核对后填写，未核对的课次保留空数组。运行 `python ../register_textbook.py --metadata 文件.json` 登记（中文内容只写入 JSON，不放命令行参数）。脚本将原文件复制为稳定的 ASCII `bookId.pdf`，记录原文件名、计算 SHA-256，并更新 `../textbooks-manifest.json`。随后运行 `python ../build.py` 重建主入口 `../index.html`。PDF 与 HTML 需一起移动，保持 `textbooks/` 相对路径。

当前已入包人民教育出版社统编版一年级至六年级上下册共 12 册 PDF，构建时校验文件头和 SHA-256。版权页、实际页数、逐课目录与词库尚未人工核对，所有 `contentVerified` 均为 `false`，不得宣称内容已校对。其他出版社目前仅可登记目录并显示“待导入”；后续接入仍须逐本、逐课通过 PRD 的 G2 门禁。

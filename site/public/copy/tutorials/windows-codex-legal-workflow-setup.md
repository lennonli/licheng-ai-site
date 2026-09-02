# Windows + Codex 法律工作流依赖与环境安装教程

生成日期：2026-07-07  
适用对象：全新 Windows 11/Windows 10、刚安装 Codex、主要处理中国法律事务、合同/Word/PDF/OCR/网页证据/企业核查工作流的用户

## 1. 任务理解与安装策略

1. 本教程面向法律工作，不是普通开发环境教程：重点支持 DOCX 合同审查、PDF 验证、扫描件 OCR、网页证据 PDF、企业网络核查、CNIPA 证据归档和 Codex Skills。
2. Windows 建议分两条线：原生 PowerShell 环境作为日常主环境；WSL2 作为可选增强环境，用于 `ocrmypdf`、Linux 命令行工具和更稳定的批量 OCR。
3. 安装工具优先使用 `winget`；Python 依赖统一放入虚拟环境；客户信息不得写入通用 Skill、公开仓库或示例命令。
4. 本教程默认使用 PowerShell 7 或 Windows Terminal。需要管理员权限的步骤会单独标注。

## 2. 先确认 Windows 基础环境

打开“Windows Terminal”或“PowerShell”，执行：

```powershell
winver
winget --version
powershell --version
```

如果 `winget` 不存在，先从 Microsoft Store 安装或更新“App Installer”，再重新打开终端。

建议先更新系统应用源：

```powershell
winget source update
winget upgrade --all
```

## 3. 安装 Codex App

如果尚未安装 Codex Windows App，可以使用 Microsoft Store/winget：

```powershell
winget install Codex -s msstore
```

安装后打开 Codex，登录账号，并在设置中确认：

1. 默认终端：建议选择 PowerShell 或 WSL。
2. 权限：日常法律文件处理建议使用默认沙箱/受控权限，不要长期使用 full access。
3. 浏览器：涉及企查查、CNIPA、信用中国等网站时，优先使用用户已登录的 Chrome。

验证 CLI：

```powershell
codex --version
codex doctor
```

如 `codex` 命令不可用，可先使用 Codex App；CLI 路径以当前官方安装方式为准。

## 4. 安装基础命令行工具

以管理员身份打开 PowerShell，执行：

```powershell
winget install -e --id Microsoft.PowerShell
winget install -e --id Microsoft.WindowsTerminal
winget install -e --id Git.Git
winget install -e --id GitHub.cli
winget install -e --id OpenJS.NodeJS.LTS
winget install -e --id BurntSushi.ripgrep.MSVC
winget install -e --id jqlang.jq
winget install -e --id 7zip.7zip
winget install -e --id Microsoft.VisualStudioCode
```

Python 建议使用 Python 官方 Windows 安装管理器。2026 年的官方推荐方式之一是：

```powershell
winget install 9NQ7512CXL7T
```

如果你的机器上 `python` 命令不可用，也可以安装具体版本：

```powershell
winget search Python.Python
winget install -e --id Python.Python.3.13
```

重新打开 PowerShell 后验证：

```powershell
git --version
gh --version
node --version
npm --version
python --version
py --version
rg --version
jq --version
7z
```

登录 GitHub：

```powershell
gh auth login
gh auth status
gh auth setup-git
```

## 5. 安装浏览器与办公组件

Chrome 是法律证据网页归档的关键工具，尤其是企查查、CNIPA、法院/税务/信用平台需要登录态或人工验证码时。

```powershell
winget install -e --id Google.Chrome
winget install -e --id TheDocumentFoundation.LibreOffice
winget install -e --id Microsoft.PowerToys
```

说明：

1. LibreOffice 用于 DOCX 转 PDF、页数检查、批量转换和端到端可打开验证。
2. PowerToys 可选，但其中 Text Extractor 适合临时从截图中提取文字。
3. 正式法律 OCR 仍建议使用 Tesseract/OCRmyPDF，并对金额、日期、案号、主体名称人工复核。

验证 LibreOffice：

```powershell
$Soffice = "C:\Program Files\LibreOffice\program\soffice.exe"
& $Soffice --version
```

如果路径不同，查找：

```powershell
Get-ChildItem "C:\Program Files" -Recurse -Filter soffice.exe -ErrorAction SilentlyContinue | Select-Object -First 5 FullName
```

## 6. 安装 PDF、图片与 OCR 工具

### 6.1 原生 Windows 工具

```powershell
winget install -e --id oschwartz10612.Poppler
winget install -e --id QPDF.QPDF
winget install -e --id ArtifexSoftware.GhostScript
winget install -e --id ImageMagick.ImageMagick
winget install -e --id UB-Mannheim.TesseractOCR
```

重新打开 PowerShell 后验证：

```powershell
pdfinfo -v
pdftotext -v
qpdf --version
gswin64c --version
magick -version
tesseract --version
tesseract --list-langs
```

如果 `pdfinfo` 或 `pdftotext` 不在 PATH，查找安装位置：

```powershell
Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter pdfinfo.exe -ErrorAction SilentlyContinue | Select-Object -First 10 FullName
Get-ChildItem "C:\Program Files" -Recurse -Filter pdfinfo.exe -ErrorAction SilentlyContinue | Select-Object -First 10 FullName
```

找到 `bin` 目录后加入用户 PATH。示例：

```powershell
$PopplerBin = "C:\Program Files\poppler\Library\bin"
$OldPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($OldPath -notlike "*$PopplerBin*") {
  [Environment]::SetEnvironmentVariable("Path", "$OldPath;$PopplerBin", "User")
}
```

重新打开 PowerShell 生效。

### 6.2 安装 Tesseract 中文语言包

检查是否已有简体中文：

```powershell
tesseract --list-langs | Select-String "chi_sim"
```

如果没有，以管理员身份打开 PowerShell：

```powershell
$TessData = "C:\Program Files\Tesseract-OCR\tessdata"
Invoke-WebRequest `
  -Uri "https://github.com/tesseract-ocr/tessdata/raw/main/chi_sim.traineddata" `
  -OutFile "$TessData\chi_sim.traineddata"

[Environment]::SetEnvironmentVariable("TESSDATA_PREFIX", $TessData, "Machine")
```

重新打开 PowerShell 后验证：

```powershell
tesseract --list-langs | Select-String "chi_sim|eng"
```

常用 OCR 命令：

```powershell
# 图片 OCR，输出 output.txt
tesseract .\input.png .\output -l chi_sim+eng

# 查看 PDF 信息
pdfinfo .\input.pdf

# 提取 PDF 文本
pdftotext .\input.pdf .\output.txt
```

## 7. 可选：安装 WSL2 作为 OCR/PDF 增强环境

`ocrmypdf` 在 WSL2/Ubuntu 中更稳。建议需要批量处理扫描 PDF 时安装。

以管理员身份打开 PowerShell：

```powershell
wsl --install -d Ubuntu
```

重启后进入 Ubuntu，执行：

```bash
sudo apt update
sudo apt install -y \
  python3 \
  python3-venv \
  python3-pip \
  poppler-utils \
  qpdf \
  ghostscript \
  imagemagick \
  tesseract-ocr \
  tesseract-ocr-chi-sim \
  tesseract-ocr-eng \
  ocrmypdf \
  unzip \
  ripgrep \
  jq
```

验证：

```bash
pdfinfo -v
pdftotext -v
qpdf --version
gs --version
tesseract --version
tesseract --list-langs | grep -E 'chi_sim|eng'
ocrmypdf --version
```

Windows 文件在 WSL 中的路径示例：

```bash
cd /mnt/c/Users/<你的用户名>/Documents
ocrmypdf -l chi_sim+eng --deskew --rotate-pages input.pdf output-searchable.pdf
```

## 8. 建立 Python 法律工作虚拟环境

建议在 Windows 用户目录下建立专门环境：

```powershell
mkdir $HOME\Legal-Codex -Force
cd $HOME\Legal-Codex
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip setuptools wheel
```

如果 PowerShell 禁止激活脚本：

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
.\.venv\Scripts\Activate.ps1
```

安装常用 Python 包：

```powershell
pip install `
  python-docx `
  lxml `
  openpyxl `
  pandas `
  pdfplumber `
  pypdf `
  pymupdf `
  reportlab `
  pillow `
  pytesseract `
  beautifulsoup4 `
  requests `
  playwright
```

安装 Playwright Chromium：

```powershell
python -m playwright install chromium
```

验证：

```powershell
python -c "import docx,lxml,openpyxl,pandas,pdfplumber,pypdf,fitz,reportlab,PIL,pytesseract,bs4,requests; print('legal python env ok')"
```

以后每次使用：

```powershell
cd $HOME\Legal-Codex
.\.venv\Scripts\Activate.ps1
```

## 9. 法律文档处理推荐验证链条

### 9.1 DOCX 合同审查

Windows 原生可用 `Expand-Archive` 解压 DOCX 包，但建议复制一份再解压：

```powershell
mkdir $HOME\Legal-Codex\work -Force
Copy-Item .\合同.docx $HOME\Legal-Codex\work\contract.zip -Force
Expand-Archive $HOME\Legal-Codex\work\contract.zip $HOME\Legal-Codex\work\contract_unzipped -Force
```

检查修订痕迹、批注和修订设置：

```powershell
Select-String -Path "$HOME\Legal-Codex\work\contract_unzipped\word\*.xml" -Pattern "<w:ins|<w:del|trackRevisions" -SimpleMatch:$false
Test-Path "$HOME\Legal-Codex\work\contract_unzipped\word\comments.xml"
```

用 Python 抽取 DOCX 文本：

```powershell
@'
from docx import Document
doc = Document(r".\合同.docx")
for i, p in enumerate(doc.paragraphs[:80], 1):
    if p.text.strip():
        print(i, p.text)
'@ | python -
```

也可保存为 `extract_docx.py`：

```python
from docx import Document

doc = Document(r".\合同.docx")
for i, p in enumerate(doc.paragraphs[:80], 1):
    if p.text.strip():
        print(i, p.text)
```

执行：

```powershell
python .\extract_docx.py
```

法律审查提醒：

1. 不要只看 Word 表面文字；有修订痕迹时，应检查 `word/document.xml`、`word/comments.xml`、`word/settings.xml`。
2. 批注可能包含关键风险信息，例如“双方未签订某年度框架协议”等。
3. 生成或修订后的 DOCX 应做可打开、可抽取、可转 PDF 验证。

### 9.2 DOCX 转 PDF 检查页数和签署页

```powershell
$Soffice = "C:\Program Files\LibreOffice\program\soffice.exe"
mkdir .\verify-pdf -Force
& $Soffice --headless --convert-to pdf --outdir .\verify-pdf .\合同.docx
pdfinfo .\verify-pdf\合同.pdf
pdftotext .\verify-pdf\合同.pdf -
```

### 9.3 PDF 底稿验证

```powershell
pdfinfo .\evidence.pdf
pdftotext .\evidence.pdf .\evidence.txt
Get-Content .\evidence.txt -TotalCount 120
```

判断网页证据 PDF 是否可靠时，不要只看“文件存在”。应核验：

1. PDF 能打开、未损坏、页数合理；
2. 文本中含目标主体名称、平台名称、查询结果或“无记录”结果；
3. 网页打印件尽量保留日期、标题、URL、页码和总页数。

## 10. Codex 全局法律工作配置

Codex 支持通过 `AGENTS.md`、Skills 和 MCP 固化法律工作流。

建议目录：

```powershell
mkdir $HOME\.codex -Force
mkdir $HOME\.codex\skills -Force
mkdir $HOME\.agents\skills -Force
mkdir $HOME\Legal-Codex\repos -Force
mkdir $HOME\Legal-Codex\outputs -Force
mkdir $HOME\Legal-Codex\evidence -Force
mkdir $HOME\Legal-Codex\templates -Force
```

### 10.1 创建全局 AGENTS.md

```powershell
notepad $HOME\.codex\AGENTS.md
```

建议填入：

```md
# 法律工作全局指令

每次回复以“李成律师”开头。

默认工作语言为中文。

默认从用户客户利益出发进行分析、起草、修订和评论；如客户身份不明确，应说明假设。

涉及中国法的合同、法律意见、通知、备忘录及客户总结，应使用中国大陆法律术语和法律文书习惯。

法律依据、案例、主体信息、企业风险信息不得编造；无法核验时标注“【待核验】”。

修订文件时，尽量保留原结构、编号和格式；修订人名称使用“锦天城-李成”。

生成 Word 文件时，应验证文件可打开、文本可抽取；涉及签署页的，签署页单独成页。
```

验证：

```powershell
codex --ask-for-approval never "Summarize the current instructions."
```

### 10.2 项目级 AGENTS.md

在具体案件/客户项目目录建立：

```powershell
cd C:\Path\To\Project
notepad .\AGENTS.md
```

示例：

```md
# 项目指令

客户：某公司
事项：股改/新三板挂牌/合同审查/法律尽调

工作要求：
- 所有文件命名使用“命名-ABL-YYYYMMDD-V1”格式。
- 不得自动填写真实签名、盖章、身份证号。
- 涉及签署前复核时，应检查错别字、前后矛盾、日期逻辑、命名、临时文件、修订痕迹和占位符。
```

## 11. 建议安装或保留的法律工作 Skills

全新 Codex 环境建议优先准备：

1. `docx-legal-review-workflow`：中文合同 DOCX 审查，尤其是有修订痕迹和批注的文件。
2. `chinese-legal-docx-drafting`：中文法律文书起草，按来源文件和模板生成 Word。
3. `network-check-v3`：中国企业网络核查，输出平台级 PDF 底稿和说明。
4. `cnipa-patent-evidence-archive`：CNIPA 专利证据 PDF 归档。
5. `cnipa-trademark-evidence-archive`：CNIPA 商标详情和流程证据 PDF 归档。
6. `batch-document-modifier`：批量修改 Word/Excel 文件、日期、文本替换、重命名。
7. `docx`、`pdf`、`xlsx`、`pptx`：通用 Office/PDF 文件处理。

如果 Skill 来自你的 GitHub 仓库：

```powershell
cd $HOME\Legal-Codex\repos
git clone https://github.com/lennonli/licheng-skills.git
```

同步到 Codex 用户 Skill 目录：

```powershell
robocopy "$HOME\Legal-Codex\repos\licheng-skills\network-check-v3" "$HOME\.codex\skills\network-check-v3" /MIR
robocopy "$HOME\Legal-Codex\repos\licheng-skills\cnipa-patent-evidence-archive" "$HOME\.codex\skills\cnipa-patent-evidence-archive" /MIR
robocopy "$HOME\Legal-Codex\repos\licheng-skills\cnipa-trademark-evidence-archive" "$HOME\.codex\skills\cnipa-trademark-evidence-archive" /MIR
```

发布或同步 Skill 前，检查客户信息：

```powershell
rg -n "客户|深圳市|有限公司|股份有限公司|统一社会信用代码|身份证|具体客户名称|项目代号|真实人员姓名" $HOME\Legal-Codex\repos\licheng-skills
```

注意：

1. 通用 Skill 不应写入客户名称、项目名称、真实证照号码等客户信息。
2. 更新 Skill 后，如果 Codex 未识别，重启 Codex。
3. 发布到 GitHub 前，先 `git status`，确认没有临时文件、缓存文件、客户底稿。

## 12. MCP 与外部数据源

法律工作常见 MCP：

1. OpenAI Docs MCP：查询 OpenAI/Codex 官方文档。
2. 北大法宝 MCP：法律法规、案例检索。
3. 企查查 MCP：主体核验、工商信息、风险信息。
4. GitHub MCP：管理私有 Skill 仓库、Issue、PR。

Codex MCP 配置通常在：

```powershell
$HOME\.codex\config.toml
```

OpenAI Docs MCP 示例：

```powershell
codex mcp add openaiDeveloperDocs --url https://developers.openai.com/mcp
```

查看 MCP：

```powershell
codex mcp --help
```

在 Codex TUI 中：

```text
/mcp
```

提示：

1. 涉及法律依据、主体信息、企业风险信息时，应优先使用权威公开来源或专业数据库核验。
2. MCP 涉及账号、Token、付费权限，应使用环境变量，不要把密钥写入公开仓库。

## 13. 浏览器证据 PDF 规则

网页证据归档时，优先使用 Chrome 原生打印/导出 PDF，并保留：

1. 打印日期；
2. 页面标题；
3. 页面 URL；
4. 页码；
5. 总页数。

Playwright/Chrome 自动化中，PDF 导出应启用类似：

```js
await page.pdf({
  path: "evidence.pdf",
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: "<span class='date'></span> <span class='title'></span>",
  footerTemplate: "<span class='url'></span> <span class='pageNumber'></span>/<span class='totalPages'></span>",
  margin: {
    top: "12mm",
    bottom: "12mm",
    left: "10mm",
    right: "10mm"
  }
});
```

导出后验证：

```powershell
pdfinfo .\evidence.pdf
pdftotext .\evidence.pdf .\evidence.txt
Get-Content .\evidence.txt -TotalCount 120
```

## 14. 一键安装脚本（PowerShell）

将以下内容保存为 `setup-legal-codex-windows.ps1`，以管理员身份运行。

```powershell
# setup-legal-codex-windows.ps1
$ErrorActionPreference = "Stop"

Write-Host "==> 1. Checking winget"
winget --version
winget source update

Write-Host "==> 2. Installing core tools"
$packages = @(
  "Microsoft.PowerShell",
  "Microsoft.WindowsTerminal",
  "Git.Git",
  "GitHub.cli",
  "OpenJS.NodeJS.LTS",
  "BurntSushi.ripgrep.MSVC",
  "jqlang.jq",
  "7zip.7zip",
  "Microsoft.VisualStudioCode",
  "Google.Chrome",
  "TheDocumentFoundation.LibreOffice",
  "Microsoft.PowerToys",
  "oschwartz10612.Poppler",
  "QPDF.QPDF",
  "ArtifexSoftware.GhostScript",
  "ImageMagick.ImageMagick",
  "UB-Mannheim.TesseractOCR"
)

foreach ($pkg in $packages) {
  Write-Host "Installing $pkg"
  winget install -e --id $pkg --accept-source-agreements --accept-package-agreements
}

Write-Host "==> 3. Installing Python manager"
winget install 9NQ7512CXL7T --accept-source-agreements --accept-package-agreements

Write-Host "==> 4. Creating folders"
New-Item -ItemType Directory -Force -Path "$HOME\Legal-Codex" | Out-Null
New-Item -ItemType Directory -Force -Path "$HOME\Legal-Codex\repos" | Out-Null
New-Item -ItemType Directory -Force -Path "$HOME\Legal-Codex\outputs" | Out-Null
New-Item -ItemType Directory -Force -Path "$HOME\Legal-Codex\evidence" | Out-Null
New-Item -ItemType Directory -Force -Path "$HOME\Legal-Codex\templates" | Out-Null
New-Item -ItemType Directory -Force -Path "$HOME\.codex" | Out-Null
New-Item -ItemType Directory -Force -Path "$HOME\.codex\skills" | Out-Null
New-Item -ItemType Directory -Force -Path "$HOME\.agents\skills" | Out-Null

Write-Host "==> 5. Creating Python virtual environment"
Set-Location "$HOME\Legal-Codex"
py -m venv .venv
& "$HOME\Legal-Codex\.venv\Scripts\Activate.ps1"
python -m pip install --upgrade pip setuptools wheel
pip install python-docx lxml openpyxl pandas pdfplumber pypdf pymupdf reportlab pillow pytesseract beautifulsoup4 requests playwright
python -m playwright install chromium

Write-Host "==> 6. Installing Tesseract Chinese language data if needed"
$TessData = "C:\Program Files\Tesseract-OCR\tessdata"
if (Test-Path $TessData) {
  $ChiSim = Join-Path $TessData "chi_sim.traineddata"
  if (-not (Test-Path $ChiSim)) {
    Invoke-WebRequest `
      -Uri "https://github.com/tesseract-ocr/tessdata/raw/main/chi_sim.traineddata" `
      -OutFile $ChiSim
  }
  [Environment]::SetEnvironmentVariable("TESSDATA_PREFIX", $TessData, "Machine")
}

Write-Host "==> 7. Verifying"
git --version
gh --version
node --version
python --version
rg --version
pdfinfo -v
tesseract --version
tesseract --list-langs
python -c "import docx,lxml,openpyxl,pandas,pdfplumber,pypdf,fitz,reportlab,PIL,pytesseract,bs4,requests; print('legal python env ok')"

Write-Host "==> Done. Reopen PowerShell before using newly installed commands."
```

执行：

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
.\setup-legal-codex-windows.ps1
```

## 15. 完整验收清单

```powershell
winget --version
codex --version
codex doctor
git --version
gh auth status
python --version
py --version
node --version
npm --version
rg --version
jq --version
pdfinfo -v
pdftotext -v
qpdf --version
gswin64c --version
magick -version
tesseract --version
tesseract --list-langs | Select-String "chi_sim|eng"
cd $HOME\Legal-Codex
.\.venv\Scripts\Activate.ps1
python -m playwright --version
```

真实文件测试：

```powershell
mkdir $HOME\Legal-Codex\test -Force
cd $HOME\Legal-Codex\test

# PDF 文本抽取
pdftotext .\sample.pdf .\sample.txt
Get-Content .\sample.txt -TotalCount 40

# DOCX 解包检查
Copy-Item .\sample.docx .\sample.zip -Force
Expand-Archive .\sample.zip .\sample_unzipped -Force
Test-Path .\sample_unzipped\word\document.xml

# DOCX 转 PDF
$Soffice = "C:\Program Files\LibreOffice\program\soffice.exe"
& $Soffice --headless --convert-to pdf --outdir . .\sample.docx
pdfinfo .\sample.pdf
```

## 16. 推荐目录结构

```text
C:\Users\<你>\Legal-Codex\
  .venv\                         # Python 法律工作虚拟环境
  repos\
    licheng-skills\              # 自己维护的 Skill 仓库
  work\                          # 临时处理文件
  outputs\                       # 对外交付文件
  evidence\                      # 网页证据、PDF 底稿
  templates\                     # 常用 Word 模板

C:\Users\<你>\.codex\
  AGENTS.md                      # 全局 Codex 法律工作指令
  config.toml                    # MCP、权限、模型等配置
  skills\                        # Codex 用户技能

C:\Users\<你>\.agents\
  skills\                        # Agent Skills 用户目录
```

## 17. 什么时候用 PowerShell，什么时候用 WSL

建议用 PowerShell：

1. Codex Windows App 日常工作；
2. Chrome 登录态网页取证；
3. Word/PDF 文件处理；
4. GitHub、Skill 同步；
5. Windows 本地文件路径下的法律文档整理。

建议用 WSL：

1. 批量扫描 PDF OCR；
2. `ocrmypdf` 流水线；
3. Linux 命令更成熟的批处理；
4. 遇到 Windows 原生包路径混乱、依赖冲突时。

注意：

1. WSL 访问 Windows 文件路径时用 `/mnt/c/Users/<你>/...`。
2. 不要把同一个 Git 仓库同时在 Windows 和 WSL 中混合提交，除非你清楚换行符和权限差异。
3. 客户底稿、扫描件、合同原件建议保存在 Windows 用户目录或同步盘中，WSL 只作为处理工具使用。

## 18. 官方参考来源

1. Microsoft WinGet 文档：<https://learn.microsoft.com/en-us/windows/package-manager/winget/>
2. Microsoft WinGet install 命令：<https://learn.microsoft.com/en-us/windows/package-manager/winget/install>
3. Microsoft WSL 安装文档：<https://learn.microsoft.com/en-us/windows/wsl/install>
4. Microsoft Python on Windows：<https://learn.microsoft.com/en-us/windows/dev-environment/python>
5. Python install manager for Windows：<https://www.python.org/downloads/release/pymanager-262/>
6. LibreOffice 下载：<https://www.libreoffice.org/download/>
7. Tesseract 安装文档：<https://tesseract-ocr.github.io/tessdoc/Installation.html>
8. Tesseract 语言数据：<https://github.com/tesseract-ocr/tessdata>
9. OCRmyPDF 安装文档：<https://ocrmypdf.readthedocs.io/en/latest/installation.html>
10. Poppler 项目：<https://poppler.freedesktop.org/>
11. qpdf 项目：<https://qpdf.sourceforge.io/>
12. Codex Manual：Windows App、Skills、AGENTS.md、MCP 相关章节

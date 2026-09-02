# macOS + Codex 法律工作流依赖与环境安装教程

生成日期：2026-07-07  
适用对象：全新 macOS、刚安装 Codex、主要处理中国法律事务、合同/Word/PDF/OCR/企业核查/证据归档工作流的用户

## 1. 任务理解与安装策略

1. 本教程不是普通开发环境教程，而是面向法律工作的本机生产环境：重点支持 DOCX 合同审查、PDF 拆分合并、扫描件 OCR、可检索底稿、网页证据 PDF、企业网络核查和 Codex Skills。
2. 安装路径分为四层：系统基础工具、文档/PDF/OCR 工具、Python 法律文档处理环境、Codex 持久化配置。
3. 原则：能用 Homebrew 管理的用 Homebrew；Python 依赖放入虚拟环境；涉及客户材料和公开仓库的 Skill 必须去客户化，不把客户名称写入通用示例。
4. 本教程默认使用 macOS 终端执行。Apple Silicon Mac 的 Homebrew 默认路径通常是 `/opt/homebrew`，Intel Mac 通常是 `/usr/local`。

## 2. 先安装 Apple 命令行工具

打开“终端”，执行：

```bash
xcode-select --install
```

验证：

```bash
git --version
clang --version
```

如果提示已经安装，可以继续下一步。

## 3. 安装 Homebrew

Homebrew 是 macOS 上安装命令行工具最方便的方式。

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

安装完成后，根据芯片类型配置 shell。

Apple Silicon：

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

Intel Mac：

```bash
echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/usr/local/bin/brew shellenv)"
```

验证：

```bash
brew --version
brew doctor
```

## 4. 安装基础命令行工具

这些工具支撑 Codex 日常读取文件、搜索文本、操作 GitHub、处理 JSON/CSV 和批量脚本。

```bash
brew update

brew install \
  git \
  gh \
  python \
  node \
  ripgrep \
  fd \
  jq \
  yq \
  tree \
  wget \
  coreutils
```

验证：

```bash
git --version
gh --version
python3 --version
node --version
rg --version
jq --version
```

登录 GitHub，便于后续把法律工作流、Skills、AGENTS.md 推送到私有仓库：

```bash
gh auth login
gh auth status
gh auth setup-git
```

## 5. 安装浏览器与办公组件

法律工作流里，Chrome 很重要：企查查、CNIPA、信用中国、法院/税务网站、网页证据 PDF 导出通常依赖 Chrome 登录态和原生打印页眉页脚。

```bash
brew install --cask google-chrome
brew install --cask libreoffice
```

验证 LibreOffice 命令行转换能力：

```bash
/Applications/LibreOffice.app/Contents/MacOS/soffice --version
```

建议给 `soffice` 建一个软链接，方便脚本调用：

```bash
mkdir -p ~/bin
ln -sf /Applications/LibreOffice.app/Contents/MacOS/soffice ~/bin/soffice
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zprofile
source ~/.zprofile
soffice --version
```

用途：

1. DOCX 转 PDF，检查页数、签署页、版式是否正常。
2. 对 Codex 生成的 Word 文件做端到端可打开验证。
3. 批量转换法律文件用于归档或客户发送。

## 6. 安装 PDF、图片与 OCR 工具

法律底稿经常遇到扫描 PDF、图片、网页打印件、证照照片。建议安装以下工具：

```bash
brew install \
  poppler \
  qpdf \
  ghostscript \
  imagemagick \
  tesseract \
  tesseract-lang \
  ocrmypdf
```

验证：

```bash
pdfinfo -v
pdftotext -v
qpdf --version
gs --version
magick -version
tesseract --version
tesseract --list-langs | grep -E 'chi_sim|eng'
ocrmypdf --version
```

常用命令：

```bash
# 查看 PDF 页数、尺寸、是否加密
pdfinfo input.pdf

# 提取 PDF 文本
pdftotext input.pdf output.txt

# 将扫描 PDF OCR 成可搜索 PDF，中文+英文
ocrmypdf -l chi_sim+eng --deskew --rotate-pages input.pdf output-searchable.pdf

# 识别单张图片
tesseract input.png output -l chi_sim+eng
```

说明：

1. macOS 自带“实况文本/Live Text”，适合日常从图片或预览里复制文字。
2. Tesseract/OCRmyPDF 更适合 Codex 批量处理扫描 PDF、证据底稿、不可复制合同。
3. OCR 结果不能直接作为法律定稿文本，金额、日期、案号、主体名称、身份证号、统一社会信用代码必须人工复核。

## 7. 建立 Python 法律工作虚拟环境

不要把法律工作依赖直接装进系统 Python。建议建立专门虚拟环境：

```bash
mkdir -p ~/Legal-Codex
cd ~/Legal-Codex
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel
```

安装常用 Python 包：

```bash
pip install \
  python-docx \
  lxml \
  openpyxl \
  pandas \
  pdfplumber \
  pypdf \
  pymupdf \
  reportlab \
  pillow \
  pytesseract \
  beautifulsoup4 \
  requests \
  playwright
```

安装 Playwright 浏览器：

```bash
python -m playwright install chromium
```

验证：

```bash
python - <<'PY'
import docx, lxml, openpyxl, pandas, pdfplumber, pypdf, fitz, reportlab, PIL, pytesseract, bs4, requests
print("legal python env ok")
PY
```

以后每次使用该环境：

```bash
source ~/Legal-Codex/.venv/bin/activate
```

## 8. 法律文档处理的推荐验证链条

### 8.1 DOCX 合同审查

收到 Word 合同后，先做结构检查：

```bash
unzip -t 合同.docx
textutil -convert txt -stdout 合同.docx | head -n 80
```

检查是否有修订痕迹和批注：

```bash
mkdir -p /tmp/docx-check
rm -rf /tmp/docx-check/*
unzip -q 合同.docx -d /tmp/docx-check

grep -R "<w:ins\\|<w:del\\|trackRevisions" /tmp/docx-check/word || true
ls /tmp/docx-check/word/comments.xml 2>/dev/null || true
```

法律审查重点：

1. 不能只看 Word 表面文本；有修订痕迹时，应检查 `word/document.xml`、`word/comments.xml`、`word/settings.xml`。
2. 生成或修订后的 DOCX 应至少通过 `unzip -t` 和 `textutil` 抽取验证。
3. 需要检查页数或签署页时，再用 LibreOffice 转 PDF：

```bash
soffice --headless --convert-to pdf --outdir ./verify-pdf 合同.docx
pdfinfo ./verify-pdf/合同.pdf
```

### 8.2 PDF 底稿验证

```bash
pdfinfo evidence.pdf
pdftotext evidence.pdf - | head -n 80
```

判断网页证据 PDF 是否可靠时，不要只看“文件存在”。应核验：

1. PDF 能打开、未损坏、页数合理。
2. 文本中含有目标主体名称、平台名称、查询结果或“无记录”结果。
3. 网页打印件应尽量保留日期、标题、URL、页码和总页数。

## 9. Codex 全局法律工作配置

Codex 支持通过 `AGENTS.md`、Skills 和 MCP 固化工作流。建议分三层：

1. 全局法律工作习惯：放在 `~/.codex/AGENTS.md`。
2. 单个项目/客户/案件特殊规则：放在项目目录的 `AGENTS.md`。
3. 可复用流程：做成 Skill，例如合同审查、网络核查、CNIPA 证据归档。

### 9.1 创建全局 AGENTS.md

```bash
mkdir -p ~/.codex
nano ~/.codex/AGENTS.md
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

验证 Codex 是否读取：

```bash
codex --ask-for-approval never "Summarize the current instructions."
```

### 9.2 项目级 AGENTS.md

在具体案件或客户项目根目录建立：

```bash
cd /path/to/project
nano AGENTS.md
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

## 10. 建议安装或保留的法律工作 Skills

如果是全新 Codex，建议优先准备这些 Skill：

1. `docx-legal-review-workflow`：中文合同 DOCX 审查，尤其是有修订痕迹和批注的文件。
2. `chinese-legal-docx-drafting`：中文法律文书起草，按来源文件和模板生成 Word。
3. `network-check-v3`：中国企业网络核查，输出平台级 PDF 底稿和说明。
4. `cnipa-patent-evidence-archive`：CNIPA 专利证据 PDF 归档。
5. `cnipa-trademark-evidence-archive`：CNIPA 商标详情和流程证据 PDF 归档。
6. `batch-document-modifier`：批量修改 Word/Excel 文件、日期、文本替换、重命名。
7. `docx`、`pdf`、`xlsx`、`pptx`：通用 Office/PDF 文件处理。

Skill 的本地路径建议：

```bash
mkdir -p ~/.agents/skills
mkdir -p ~/.codex/skills
```

如果 Skill 来自你的 GitHub 仓库，建议统一放在：

```bash
mkdir -p ~/Legal-Codex/repos
cd ~/Legal-Codex/repos
git clone https://github.com/lennonli/licheng-skills.git
```

然后将需要的 Skill 同步到本地用户 Skill 目录。示例：

```bash
rsync -a ~/Legal-Codex/repos/licheng-skills/network-check-v3/ ~/.codex/skills/network-check-v3/
rsync -a ~/Legal-Codex/repos/licheng-skills/cnipa-patent-evidence-archive/ ~/.codex/skills/cnipa-patent-evidence-archive/
rsync -a ~/Legal-Codex/repos/licheng-skills/cnipa-trademark-evidence-archive/ ~/.codex/skills/cnipa-trademark-evidence-archive/
```

注意：

1. 通用 Skill 不应写入客户名称、项目名称、真实证照号码等客户信息。
2. 更新 Skill 后，如果 Codex 未识别，重启 Codex。
3. 发布到 GitHub 前，先检查是否含客户信息：

```bash
rg -n "客户|深圳市|有限公司|股份有限公司|统一社会信用代码|身份证|具体客户名称|项目代号|真实人员姓名" ~/Legal-Codex/repos/licheng-skills
```

## 11. MCP 与外部数据源

法律工作常见 MCP：

1. OpenAI Docs MCP：查询 OpenAI/Codex 官方文档。
2. 北大法宝 MCP：法律法规、案例检索。
3. 企查查 MCP：主体核验、工商信息、风险信息。
4. GitHub MCP：管理私有 Skill 仓库、Issue、PR。

Codex MCP 配置通常在：

```bash
~/.codex/config.toml
```

OpenAI Docs MCP 示例：

```bash
codex mcp add openaiDeveloperDocs --url https://developers.openai.com/mcp
```

查看 MCP：

```bash
codex mcp --help
```

在 Codex TUI 中可用：

```text
/mcp
```

提示：

1. 涉及法律依据、主体信息、企业风险信息时，应优先使用权威公开来源或专业数据库核验。
2. MCP 涉及账号、Token、付费权限，应使用环境变量，不要把密钥写入公开仓库。

## 12. 浏览器证据 PDF 规则

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

```bash
pdfinfo evidence.pdf
pdftotext evidence.pdf - | head -n 120
```

## 13. 一键安装脚本

可以把下面内容保存为 `setup-legal-codex-macos.sh` 后执行。

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "==> 1. Checking Xcode Command Line Tools"
if ! xcode-select -p >/dev/null 2>&1; then
  echo "Please install Xcode Command Line Tools, then rerun this script:"
  echo "  xcode-select --install"
  exit 1
fi

echo "==> 2. Checking Homebrew"
if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew not found. Install it first:"
  echo '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  exit 1
fi

echo "==> 3. Installing CLI tools"
brew update
brew install git gh python node ripgrep fd jq yq tree wget coreutils

echo "==> 4. Installing office/PDF/OCR tools"
brew install poppler qpdf ghostscript imagemagick tesseract tesseract-lang ocrmypdf
brew install --cask google-chrome || true
brew install --cask libreoffice || true

echo "==> 5. Linking LibreOffice soffice"
mkdir -p "$HOME/bin"
if [ -x "/Applications/LibreOffice.app/Contents/MacOS/soffice" ]; then
  ln -sf "/Applications/LibreOffice.app/Contents/MacOS/soffice" "$HOME/bin/soffice"
fi
if ! grep -q 'export PATH="$HOME/bin:$PATH"' "$HOME/.zprofile" 2>/dev/null; then
  echo 'export PATH="$HOME/bin:$PATH"' >> "$HOME/.zprofile"
fi

echo "==> 6. Creating Python virtual environment"
mkdir -p "$HOME/Legal-Codex"
cd "$HOME/Legal-Codex"
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel
pip install python-docx lxml openpyxl pandas pdfplumber pypdf pymupdf reportlab pillow pytesseract beautifulsoup4 requests playwright
python -m playwright install chromium

echo "==> 7. Creating Codex folders"
mkdir -p "$HOME/.codex" "$HOME/.agents/skills" "$HOME/.codex/skills"

echo "==> 8. Verifying"
git --version
python3 --version
node --version
rg --version
pdfinfo -v || true
tesseract --version
tesseract --list-langs | grep -E 'chi_sim|eng' || true
python - <<'PY'
import docx, lxml, openpyxl, pandas, pdfplumber, pypdf, fitz, reportlab, PIL, pytesseract, bs4, requests
print("legal python env ok")
PY

echo "==> Done. Restart Terminal or run: source ~/.zprofile"
```

执行：

```bash
chmod +x setup-legal-codex-macos.sh
./setup-legal-codex-macos.sh
```

## 14. 完整验收清单

```bash
brew doctor
git --version
gh auth status
python3 --version
node --version
rg --version
soffice --version
pdfinfo -v
pdftotext -v
qpdf --version
tesseract --version
tesseract --list-langs | grep chi_sim
ocrmypdf --version
source ~/Legal-Codex/.venv/bin/activate
python -m playwright --version
```

建议再做一个真实文件测试：

```bash
mkdir -p ~/Legal-Codex/test
cd ~/Legal-Codex/test

# 测试 PDF 文本抽取
pdftotext sample.pdf sample.txt

# 测试 DOCX 可读
unzip -t sample.docx
textutil -convert txt -stdout sample.docx | head -n 40

# 测试 DOCX 转 PDF
soffice --headless --convert-to pdf --outdir . sample.docx
pdfinfo sample.pdf
```

## 15. 推荐目录结构

```text
~/Legal-Codex/
  .venv/                         # Python 法律工作虚拟环境
  repos/
    licheng-skills/              # 自己维护的 Skill 仓库
  work/                          # 临时处理文件
  outputs/                       # 对外交付文件
  evidence/                      # 网页证据、PDF 底稿
  templates/                     # 常用 Word 模板

~/.codex/
  AGENTS.md                      # 全局 Codex 法律工作指令
  config.toml                    # MCP、权限、模型等配置
  skills/                        # Codex 用户技能

~/.agents/
  skills/                        # Agent Skills 用户目录
```

## 16. 什么时候需要额外安装

1. 需要处理老旧 `.doc`：优先用 LibreOffice 转 `.docx`。
2. 需要批量 OCR 低质量扫描件：可另装专业 OCR 软件或使用更高质量扫描源。
3. 需要访问企查查、北大法宝、CNIPA：需要浏览器登录态、MCP 或账号权限。
4. 需要网页自动化：确认 Chrome 已安装，并让 Codex 使用用户 Chrome 会话处理验证码。
5. 需要对外发布 Skill：先去客户化，再 `git status`、`rg` 检查敏感信息，最后提交推送。

## 17. 官方参考来源

1. Homebrew 官网：<https://brew.sh/>
2. Homebrew 安装文档：<https://docs.brew.sh/Installation>
3. Homebrew tesseract：<https://formulae.brew.sh/formula/tesseract>
4. Homebrew tesseract-lang：<https://formulae.brew.sh/formula/tesseract-lang>
5. Homebrew poppler：<https://formulae.brew.sh/formula/poppler>
6. Homebrew ocrmypdf：<https://formulae.brew.sh/formula/ocrmypdf>
7. LibreOffice 下载：<https://www.libreoffice.org/download/>
8. LibreOffice 安装说明：<https://www.libreoffice.org/installation-instructions/>
9. Codex Manual：Skills、AGENTS.md、MCP、Local environments 相关章节

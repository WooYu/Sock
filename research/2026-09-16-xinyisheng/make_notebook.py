"""Create and execute a small inspection notebook against frozen source files."""
from pathlib import Path
import nbformat as nbf
from nbclient import NotebookClient

ROOT = Path(__file__).resolve().parent
nb = nbf.v4.new_notebook()
nb.metadata.kernelspec = {"display_name": "Python 3 (StockCal research)", "language": "python", "name": "python3"}
nb.cells = [
    nbf.v4.new_markdown_cell("# 新易盛：笔记经验与原则的三年回溯检验\n\n## tl;dr\n\n组合模型尚未证明优于简单对照。以下单元从冻结行情重新计算，并展示完整来源与回测结果。详细解释见同目录 report.md。"),
    nbf.v4.new_markdown_cell("## Context & Methods\n\n股票300502；实际复权评估2023-09-18至2026-09-15，未来1–4个交易日；最近一年留出。所有案例后续结果必须早于当前10日观察窗口。\n\n### Key Assumptions\n\nBOLL20/2总体标准差、SMA5/10/20。笔记增量外推不是收盘价预测；当前笔记版本回看过去是回溯研究，不是实时前瞻证明。只有一只用户指定股票，不能泛化。"),
    nbf.v4.new_code_cell("from pathlib import Path\nimport sys, json\nimport pandas as pd\nfrom IPython.display import display, Image\nROOT = Path.cwd()\nassert (ROOT / 'backtest.py').exists(), '从本笔记所在目录运行'\nsys.path.insert(0, str(ROOT))\nfrom validate_inputs import validate\nfrom backtest import run_backtest\nfrom evaluate_principles import evaluate\nfrom render_report import render\nframe, quality = validate()\nquality"),
    nbf.v4.new_markdown_cell("## Analysis\n\n### 1. 重算所有预测原点\n\n固定方法，不按留出结果调整参数。"),
    nbf.v4.new_code_cell("forecasts, indicators = run_backtest(frame)\nevaluate()\nsummary = json.loads((ROOT / 'results/summary.json').read_text(encoding='utf-8'))\nprice_table = pd.DataFrame(summary['price'])\ndisplay(price_table.query(\"partition == 'holdout' and horizon in [3,4]\")[['model','horizon','origins','close_mape','direction_accuracy_pct']])"),
    nbf.v4.new_markdown_cell("### 2. 检查对照差异及不确定性\n\n改善为正才代表比对照误差小；20日时间块重采样处理重叠预测的相关性。"),
    nbf.v4.new_code_cell("comparison = pd.DataFrame(summary['pairedBlockBootstrap'])\ndisplay(comparison.query(\"partition == 'holdout' and horizon in [3,4]\"))"),
    nbf.v4.new_markdown_cell("## Results\n\n### 3. 价格、参数及参考位\n\n图表来自上述重算的账本；低参数误差不等于交易胜率。"),
    nbf.v4.new_code_cell("render()\nfor name in ['01-history-and-split.png','02-price-errors.png','03-indicator-errors.png','05-manual-reference-check.png','04-latest-complete-replay.png']:\n    display(Image(filename=str(ROOT / 'figures' / name)))"),
    nbf.v4.new_markdown_cell("## Takeaways\n\n确认经验的含义、补齐情境标签和保留反例，比无休止训练Agent更优先。当前组合没有稳定收盘预测增益；新定义需要多股与未来时段验证。手动提示应保留类型、股票、有效期和版本；确认解释不得自动启用交易。"),
]
nbf.validate(nb)
executed = NotebookClient(nb, timeout=180, kernel_name="python3", resources={"metadata": {"path": str(ROOT)}}).execute()
nbf.validate(executed)
nbf.write(executed, ROOT / "analysis.ipynb")
print(f"Executed notebook: {ROOT / 'analysis.ipynb'}")

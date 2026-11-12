window.__ModuleLoader__.load({
  id: '@tomjerrygit/dsh-workspace-audit',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const PANEL_ID = 'workspace-audit';
    const NS = 'workspaceAudit';
    const zh = {
      panel: '工作区体检',
      title: '工作区体检',
      subtitle: '本地只读扫描：Git、测试、CI、体积、安全与交接报告',
      scan: '开始体检',
      scanning: '扫描中…',
      refresh: '刷新',
      addRoot: '添加工作区路径',
      rootPlaceholder: '例如 D:\\MyProject',
      add: '添加',
      empty: '暂无工作区。先添加一个目录，或等待 DSH 工作区注册表出现。',
      score: '综合评分',
      workspaces: '工作区',
      p0: 'P0 风险',
      risks: '风险',
      dimensions: '维度',
      report: '交接报告',
      copy: '复制报告',
      copied: '已复制',
      download: '下载 Markdown',
      failed: '扫描失败',
      loading: '正在准备…',
      path: '路径',
      git: 'Git',
      size: '体积',
      tests: '测试文件',
      todo: 'TODO',
      noRisk: '未发现阻塞风险',
      commands: '启动/测试入口见各项目 README 与报告。',
      filterAll: '全部风险',
      comparison: '项目对比',
      trend: '趋势',
      deps: '依赖',
      vulns: '漏洞',
      github: 'GitHub',
      release: 'Release',
      branch: '分支保护',
      noLock: '无锁文件',
      html: '导出 HTML',
      commandsTitle: '启动/测试命令',
      online: '允许网络检查',
      onlineHint: '开启后才会调用 npm/pip audit 与 GitHub API；默认离线。',
      offline: '离线',
      duration: '耗时',
      failures: '扫描失败',
      gitMissing: '未检测到 Git',
      p0Capped: 'P0 风险已限制总分',
      projectType: '项目类型',
      deductions: '扣分明细',
      progress: '扫描进度',
      cancel: '取消扫描',
      baseline: '设为基线',
      baselineSet: '基线已保存',
      ignored: '已忽略',
      accepted: '已接受',
      baselineDelta: '相对基线',
      newRisks: '新增风险',
      configHint: '可在项目根目录用 .workspace-audit.json 配置 ignore/accept。',
      handover: '下载交接文档',
      pdf: '导出 PDF',
      trendChart: '平均分趋势',
      issues: 'Issue',
      prs: 'PR',
      until: '至',
      json: '下载 JSON',
      feedback: '报告误报',
      dimensions: { documentation: '文档', development: '开发', debugging: '调试', performance: '性能', functionality: '功能', security: '安全', github: 'GitHub' },
    };
    const en = {
      panel: 'Workspace Audit',
      title: 'Workspace Audit',
      subtitle: 'Read-only local scan: Git, tests, CI, size, security, handover report',
      scan: 'Run audit',
      scanning: 'Scanning…',
      refresh: 'Refresh',
      addRoot: 'Add workspace path',
      rootPlaceholder: 'e.g. D:\\MyProject',
      add: 'Add',
      empty: 'No workspaces yet. Add a directory or wait for the DSH workspace registry.',
      score: 'Overall score',
      workspaces: 'Workspaces',
      p0: 'P0 risks',
      risks: 'Risks',
      dimensions: 'Dimensions',
      report: 'Handover report',
      copy: 'Copy report',
      copied: 'Copied',
      download: 'Download Markdown',
      failed: 'Scan failed',
      loading: 'Preparing…',
      path: 'Path',
      git: 'Git',
      size: 'Size',
      tests: 'Test files',
      todo: 'TODO',
      noRisk: 'No blocking risks found',
      commands: 'See each project README and report for run/test commands.',
      filterAll: 'All risks',
      comparison: 'Workspace comparison',
      trend: 'Trend',
      deps: 'Deps',
      vulns: 'Vulns',
      github: 'GitHub',
      release: 'Release',
      branch: 'Branch protection',
      noLock: 'No lockfile',
      html: 'Export HTML',
      commandsTitle: 'Run/test commands',
      online: 'Allow network checks',
      onlineHint: 'Enables npm/pip audit and GitHub API; offline by default.',
      offline: 'Offline',
      duration: 'Duration',
      failures: 'Scan failures',
      gitMissing: 'Git not detected',
      p0Capped: 'P0 caps the score',
      projectType: 'Project type',
      deductions: 'Score deductions',
      progress: 'Scan progress',
      cancel: 'Cancel scan',
      baseline: 'Set baseline',
      baselineSet: 'Baseline saved',
      ignored: 'Ignored',
      accepted: 'Accepted',
      baselineDelta: 'vs baseline',
      newRisks: 'New risks',
      configHint: 'Configure ignore/accept in .workspace-audit.json at the project root.',
      handover: 'Download handover',
      pdf: 'Export PDF',
      trendChart: 'Average score trend',
      issues: 'Issues',
      prs: 'PRs',
      until: 'until',
      json: 'Download JSON',
      feedback: 'Report false positive',
      dimensions: { documentation: 'Docs', development: 'Dev', debugging: 'Debug', performance: 'Perf', functionality: 'Features', security: 'Security', github: 'GitHub' },
    };
    const page = { display: 'flex', flexDirection: 'column', gap: '14px', padding: '24px 32px', minHeight: '100%', overflow: 'auto', color: 'var(--dsw-alias-label-primary)' };
    const card = { border: '1px solid var(--dsw-alias-border-l1)', borderRadius: '14px', padding: '14px', background: 'var(--dsw-alias-bg-layer-1)' };
    const money = (bytes) => {
      const value = Number(bytes) || 0;
      if (value < 1024 * 1024) return Math.round(value / 1024) + 'KB';
      if (value < 1024 * 1024 * 1024) return (value / 1024 / 1024).toFixed(1) + 'MB';
      return (value / 1024 / 1024 / 1024).toFixed(1) + 'GB';
    };
    const grade = (score) => (score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D');
    const color = (score) => (score >= 85 ? 'var(--dsw-alias-state-success-primary)' : score >= 70 ? 'var(--dsw-alias-state-warn-primary)' : 'var(--dsw-alias-state-error-primary)');
    const sparkline = (values) => {
      if (!Array.isArray(values) || values.length < 2) return null;
      const width = 90;
      const height = 22;
      const points = values.map((value, index) => (index / (values.length - 1)) * width + ',' + (height - Math.max(0, Math.min(100, value)) / 100 * height).toFixed(1)).join(' ');
      return h('svg', { width, height, viewBox: '0 0 ' + width + ' ' + height, style: { verticalAlign: 'middle', marginLeft: '4px' }, 'aria-hidden': true },
        h('polyline', { points, fill: 'none', stroke: 'var(--dshqn-accent, var(--dsw-alias-brand-primary))', strokeWidth: '1.5' }));
    };

    function Panel() {
      const t = (key) => { const dict = /^zh/i.test(String(window.navigator && window.navigator.language)) ? zh : en; return dict[key] || key; };
      const isZh = /^zh/i.test(String(window.navigator && window.navigator.language));
      const [token, setToken] = React.useState('');
      const [scan, setScan] = React.useState(null);
      const [state, setState] = React.useState('loading');
      const [rootDraft, setRootDraft] = React.useState('');
      const [riskFilter, setRiskFilter] = React.useState('all');
      const [history, setHistory] = React.useState([]);
      const [copied, setCopied] = React.useState(false);
      const [job, setJob] = React.useState(null);
      const [progress, setProgress] = React.useState(null);
      const [notice, setNotice] = React.useState('');
      const auth = () => token.length > 0 ? Promise.resolve(token) : fetch('/api/workspace-audit/auth').then((res) => res.json()).then((payload) => { setToken(payload.token); return payload.token; });
      const headers = (value) => ({ 'x-workspace-audit-token': value, accept: 'application/json' });
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const loadHistory = (value) => fetch('/api/workspace-audit/history', { headers: headers(value), cache: 'no-store' }).then((res) => res.ok ? res.json() : []).catch(() => []);
      const load = () => {
        auth().then(async (value) => {
          setState('loading');
          setProgress({ completed: 0, total: 0, state: 'running' });
          const start = await fetch('/api/workspace-audit/scan/start', { method: 'POST', headers: headers(value), cache: 'no-store' });
          if (!start.ok) throw new Error(String(start.status));
          const started = await start.json();
          setJob(started);
          for (;;) {
            await sleep(500);
            const status = await fetch('/api/workspace-audit/scan/status?jobId=' + encodeURIComponent(started.jobId), { headers: headers(value), cache: 'no-store' });
            if (!status.ok) throw new Error(String(status.status));
            const payload = await status.json();
            setProgress(payload.progress);
            if (payload.state === 'done' || payload.state === 'cancelled') {
              setScan(payload.result);
              setHistory(await loadHistory(value));
              setState('ready');
              setJob(null);
              return;
            }
            if (payload.state === 'error') throw new Error(payload.error || 'scan failed');
          }
        }).catch(() => setState('failed'));
      };
      const cancel = () => {
        if (!job) return;
        auth().then((value) => fetch('/api/workspace-audit/scan/cancel', { method: 'POST', headers: { ...headers(value), 'content-type': 'application/json' }, body: JSON.stringify({ jobId: job.jobId }) })).catch(() => {});
      };
      const setBaseline = () => {
        if (!scan) return;
        auth().then((value) => fetch('/api/workspace-audit/baseline', { method: 'POST', headers: { ...headers(value), 'content-type': 'application/json' }, body: JSON.stringify({ workspaces: (scan.workspaces || []).map((workspace) => ({ path: workspace.path, score: workspace.score, riskIds: (workspace.risks || []).map((risk) => risk.id), dimensions: workspace.dimensions })) }) }))
          .then((res) => { if (!res.ok) throw new Error(String(res.status)); setNotice(t('baselineSet')); return load(); })
          .catch(() => setNotice(t('failed')));
      };
      const addRoot = () => {
        auth().then((value) => fetch('/api/workspace-audit/settings', { method: 'POST', headers: { ...headers(value), 'content-type': 'application/json' }, body: JSON.stringify({ add: rootDraft.trim() }) }))
          .then(() => { setRootDraft(''); return load(); })
          .catch(() => {});
      };
      const toggleOnline = () => {
        const next = !(scan && scan.settings && scan.settings.online);
        auth().then((value) => fetch('/api/workspace-audit/settings', { method: 'POST', headers: { ...headers(value), 'content-type': 'application/json' }, body: JSON.stringify({ online: next }) }))
          .then(() => load())
          .catch(() => {});
      };
      const copy = () => { if (!scan) return; navigator.clipboard.writeText(isZh ? scan.report : (scan.reportEn || scan.report)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); };
      const download = () => {
        if (!scan) return;
        const blob = new Blob([isZh ? scan.report : (scan.reportEn || scan.report)], { type: 'text/markdown;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'workspace-audit.md';
        link.click();
        URL.revokeObjectURL(link.href);
      };
      const downloadHandover = () => {
        if (!scan) return;
        const blob = new Blob([isZh ? scan.handover : (scan.handoverEn || scan.handover)], { type: 'text/markdown;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'START_HERE.md';
        link.click();
        URL.revokeObjectURL(link.href);
      };
      const downloadJson = () => {
        if (!scan) return;
        const payload = { ...scan, report: undefined, reportEn: undefined, handover: undefined, handoverEn: undefined };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'workspace-audit.json';
        link.click();
        URL.revokeObjectURL(link.href);
      };
      const reportFalsePositive = () => {
        const title = encodeURIComponent('[false-positive] workspace-audit');
        window.open('https://github.com/TomJerryGit/dsh-workspace-audit/issues/new?template=bug_report.yml&title=' + title, '_blank');
      };
      const printReport = () => {
        if (!scan) return;
        const report = isZh ? scan.report : (scan.reportEn || scan.report);
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write('<!doctype html><meta charset="utf-8"><title>Workspace Audit</title><pre style="white-space:pre-wrap;font-family:system-ui,sans-serif;padding:24px">' + String(report).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) + '</pre>');
        win.document.close();
        win.focus();
        win.print();
      };
      const downloadHtml = () => {
        if (!scan) return;
        const escape = (value) => String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
        const rows = (scan.workspaces || []).map((workspace) => '<tr><td>' + escape(workspace.title) + '</td><td><b>' + workspace.score + '</b></td><td>' + escape(Object.entries(workspace.dimensions).map(([key, value]) => (t('dimensions') && t('dimensions')[key] ? t('dimensions')[key] : key) + ' ' + value).join(' · ')) + '</td><td>' + escape((workspace.risks || []).map((risk) => '[' + risk.severity + '] ' + (isZh ? risk.text : (risk.en || risk.text))).join('<br/>')) + '</td></tr>').join('');
        const report = isZh ? scan.report : (scan.reportEn || scan.report);
        const handover = isZh ? scan.handover : (scan.handoverEn || scan.handover);
        const html = '<!doctype html><meta charset="utf-8"><title>' + (isZh ? '工作区体检' : 'Workspace Audit') + '</title><style>body{font-family:system-ui,sans-serif;margin:32px;color:#222}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px;vertical-align:top;font-size:13px}th{text-align:left}</style><h1>' + (isZh ? '工作区体检' : 'Workspace Audit') + '</h1><p>' + (isZh ? '生成时间：' : 'Generated: ') + new Date(scan.generatedAt).toLocaleString() + '</p><table><thead><tr><th>' + t('workspaces') + '</th><th>' + t('score') + '</th><th>' + (isZh ? '维度' : 'Dimensions') + '</th><th>' + (isZh ? '风险' : 'Risks') + '</th></tr></thead><tbody>' + rows + '</tbody></table><h2>' + (isZh ? '交接文档' : 'Handover') + '</h2><pre style="white-space:pre-wrap">' + escape(handover || '') + '</pre><h2>' + (isZh ? '报告' : 'Report') + '</h2><pre style="white-space:pre-wrap;margin-top:24px">' + escape(report || '') + '</pre>';
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'workspace-audit.html';
        link.click();
        URL.revokeObjectURL(link.href);
      };
      React.useEffect(() => { load(); }, []);
      if (state === 'loading') return h('div', { style: page },
        h('h1', { style: { margin: 0, fontSize: '22px' } }, t('title')),
        h('p', { style: { color: 'var(--dsw-alias-label-secondary)' } }, t('scanning')),
        progress ? h('div', { style: { maxWidth: '420px' } },
          h('div', { style: { height: '8px', borderRadius: '999px', background: 'var(--dsw-alias-bg-layer-2)', overflow: 'hidden' } },
            h('div', { style: { width: (progress.total > 0 ? Math.round(progress.completed / progress.total * 100) : 5) + '%', height: '100%', background: 'var(--dshqn-accent, var(--dsw-alias-brand-primary))' } })),
          h('p', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, t('progress') + '：' + progress.completed + ' / ' + progress.total),
        ) : null,
        job ? h('button', { type: 'button', onClick: cancel }, t('cancel')) : null,
      );
      if (state === 'failed' || scan === null) return h('div', { style: page }, h('h1', { style: { margin: 0, fontSize: '22px' } }, t('title')), h('p', { style: { color: 'var(--dsw-alias-label-secondary)' } }, t('failed')), h('button', { type: 'button', onClick: load }, t('scan')));
      const workspaces = Array.isArray(scan.workspaces) ? scan.workspaces : [];
      const filteredWorkspaces = workspaces.filter((workspace) => riskFilter === 'all' || (workspace.risks || []).some((risk) => risk.severity === riskFilter));
      const avg = workspaces.length > 0 ? Math.round(workspaces.reduce((sum, workspace) => sum + workspace.score, 0) / workspaces.length) : 0;
      const p0 = workspaces.reduce((sum, workspace) => sum + workspace.risks.filter((risk) => risk.severity === 'P0').length, 0);
      const historyFor = (workspacePath) => history
        .map((entry) => Array.isArray(entry.workspaces) ? entry.workspaces.find((row) => row.path === workspacePath) : null)
        .filter(Boolean)
        .map((row) => row.score);
      const averageHistory = history.map((entry) => {
        const rows = Array.isArray(entry.workspaces) ? entry.workspaces : [];
        return rows.length > 0 ? Math.round(rows.reduce((sum, row) => sum + (Number(row.score) || 0), 0) / rows.length) : 0;
      });
      return h('div', { style: page },
        h('header', { style: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' } },
          h('div', { style: { flex: '1 1 auto' } }, h('h1', { style: { margin: 0, fontSize: '22px' } }, t('title')), h('p', { style: { margin: '4px 0 0', color: 'var(--dsw-alias-label-secondary)', fontSize: '13px' } }, t('subtitle'))),
          h('button', { type: 'button', onClick: load, style: { padding: '6px 12px', borderRadius: '8px' } }, t('scan')),
        ),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' } },
          h('div', { style: card }, h('div', { style: { fontSize: '24px', fontWeight: 700, color: color(avg) } }, avg + ' / ' + grade(avg)), h('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, t('score'))),
          h('div', { style: card }, h('div', { style: { fontSize: '24px', fontWeight: 700 } }, String(workspaces.length)), h('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, t('workspaces'))),
          h('div', { style: card }, h('div', { style: { fontSize: '24px', fontWeight: 700, color: 'var(--dsw-alias-state-error-primary)' } }, String(p0)), h('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, t('p0'))),
        ),
        h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
          h('input', { value: rootDraft, placeholder: t('rootPlaceholder'), onChange: (event) => setRootDraft(event.target.value), style: { flex: '1 1 260px', padding: '6px 8px' } }),
          h('button', { type: 'button', onClick: addRoot, disabled: rootDraft.trim().length === 0 }, t('add')),
          h('button', { type: 'button', onClick: toggleOnline, style: { fontWeight: scan.settings.online ? 700 : 400 } }, (scan.settings.online ? '✓ ' : '') + t('online')),
          ['all', 'P0', 'P1', 'P2'].map((severity) => h('button', { key: severity, type: 'button', onClick: () => setRiskFilter(severity), style: { fontWeight: riskFilter === severity ? 700 : 400 } }, severity === 'all' ? t('filterAll') : severity)),
          h('button', { type: 'button', onClick: copy }, copied ? t('copied') : t('copy')),
          h('button', { type: 'button', onClick: download }, t('download')),
          h('button', { type: 'button', onClick: downloadHtml }, t('html')),
          h('button', { type: 'button', onClick: downloadHandover }, t('handover')),
          h('button', { type: 'button', onClick: downloadJson }, t('json')),
          h('button', { type: 'button', onClick: printReport }, t('pdf')),
          h('button', { type: 'button', onClick: reportFalsePositive }, t('feedback')),
          h('button', { type: 'button', onClick: setBaseline }, t('baseline')),
        ),
        notice.length > 0 ? h('p', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, notice) : null,
        h('p', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, t('configHint')),
        workspaces.length === 0 ? h('p', { style: { color: 'var(--dsw-alias-label-secondary)' } }, t('empty')) : null,
        h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } },
          t('duration') + '：' + Math.round((scan.durationMs || 0) / 1000) + 's · ' + (scan.settings.online ? t('online') : t('offline')) +
          (scan.environment && scan.environment.git === false ? ' · ' + t('gitMissing') : '') + ' · ' + t('onlineHint')),
        scan.failures && scan.failures.length > 0
          ? h('section', { style: card }, h('strong', { style: { fontSize: '13px' } }, t('failures')), ...scan.failures.map((failure) => h('div', { key: failure.path, style: { fontSize: '11px', color: 'var(--dsw-alias-state-warn-primary)', marginTop: '4px' } }, failure.path + '：' + failure.error)))
          : null,
        workspaces.length > 0 ? h('section', { style: card },
          h('h2', { style: { margin: 0, fontSize: '16px' } }, t('comparison')),
          h('div', { style: { overflowX: 'auto', marginTop: '8px' } },
            h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '11px' } },
              h('thead', null, h('tr', null, ['workspace', 'score', 'documentation', 'development', 'debugging', 'performance', 'functionality', 'security', 'github', 'trend'].map((key) => h('th', { key, style: { textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid var(--dsw-alias-border-l1)' } }, key === 'workspace' ? t('workspaces') : key === 'score' ? t('score') : key === 'trend' ? t('trend') : (t('dimensions') && t('dimensions')[key]) || key)))),
              h('tbody', null, workspaces.map((workspace) => h('tr', { key: workspace.path },
                h('td', { style: { padding: '4px 6px' } }, workspace.title),
                h('td', { style: { padding: '4px 6px', fontWeight: 700, color: color(workspace.score) } }, workspace.score),
                ...['documentation', 'development', 'debugging', 'performance', 'functionality', 'security', 'github'].map((key) => h('td', { key, style: { padding: '4px 6px' } }, workspace.dimensions[key])),
                h('td', { key: 'trend', style: { padding: '4px 6px', color: workspace.trend && workspace.trend.delta > 0 ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-label-secondary)' } }, workspace.trend && workspace.trend.delta !== null ? (workspace.trend.delta >= 0 ? '+' : '') + workspace.trend.delta : '—'),
              ))),
            ),
          ),
          averageHistory.length > 1
            ? h('div', { style: { marginTop: '12px' } },
                h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)', marginBottom: '4px' } }, t('trendChart')),
                h('svg', { viewBox: '0 0 600 100', preserveAspectRatio: 'none', style: { width: '100%', height: '90px' } },
                  h('polyline', {
                    points: averageHistory.map((value, index) => (index / (averageHistory.length - 1)) * 600 + ',' + (100 - Math.max(0, Math.min(100, value)))).join(' '),
                    fill: 'none',
                    stroke: 'var(--dshqn-accent, var(--dsw-alias-brand-primary))',
                    strokeWidth: '2',
                  }),
                ),
              )
            : null,
        ) : null,
        filteredWorkspaces.map((workspace) => {
          const risks = workspace.risks || [];
          return h('section', { key: workspace.path, style: card },
            h('div', { style: { display: 'flex', gap: '10px', alignItems: 'baseline', flexWrap: 'wrap' } },
              h('h2', { style: { margin: 0, fontSize: '16px', flex: '1 1 auto' } }, workspace.title),
              workspace.trend && workspace.trend.delta !== null ? h('span', { style: { fontSize: '12px', color: workspace.trend.delta >= 0 ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)' } }, (workspace.trend.delta >= 0 ? '+' : '') + workspace.trend.delta) : null,
              sparkline(historyFor(workspace.path)),
              h('strong', { style: { fontSize: '20px', color: color(workspace.score) } }, workspace.score + ' ' + grade(workspace.score)),
            ),
            h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)', margin: '4px 0 8px' } }, t('path') + '：' + workspace.path + ' · ' + t('projectType') + '：' + (workspace.projectType || 'app')),
            workspace.deductions && workspace.deductions.length > 0
              ? h('details', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } },
                  h('summary', null, t('deductions')),
                  ...workspace.deductions.slice(0, 5).map((deduction) => h('div', { key: deduction.dimension + deduction.points }, deduction.dimension + '：-' + deduction.points + (deduction.reason ? ' · ' + deduction.reason : ''))),
                )
              : null,
            h('div', { style: { display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12px' } },
              h('span', null, t('git') + ': ' + (workspace.git.isRepo ? workspace.git.branch || 'repo' : 'none')),
              h('span', null, t('size') + ': ' + money(workspace.size.bytes)),
              h('span', null, t('tests') + ': ' + workspace.testFiles),
              h('span', null, t('todo') + ': ' + workspace.todo),
            ),
            h('div', { style: { display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--dsw-alias-label-secondary)', marginTop: '4px' } },
              workspace.dependencies && workspace.dependencies.manifests.length > 0
                ? h('span', null, t('deps') + ': ' + (workspace.dependencies.lockfiles.length > 0 ? 'lock ✓' : t('noLock')) + ' · ' + t('vulns') + ' ' + workspace.dependencies.vulnerabilities.total + (workspace.dependencies.vulnerabilities.status === 'offline' ? ' (' + t('offline') + ')' : workspace.dependencies.vulnerabilities.status === 'skipped' ? ' (skipped)' : workspace.dependencies.vulnerabilities.status === 'error' ? ' (error)' : workspace.dependencies.vulnerabilities.tool ? ' (' + workspace.dependencies.vulnerabilities.tool + ')' : ''))
                : null,
              !scan.settings.online
                ? h('span', null, t('github') + ': ' + t('offline'))
                : workspace.github
                  ? h('span', null, t('github') + ': ' + workspace.github.owner + '/' + workspace.github.repo + ' · ' + t('release') + ' ' + (workspace.github.latestRelease || '—') + ' · ' + t('issues') + ' ' + (workspace.github.openIssues ?? '—') + ' / ' + t('prs') + ' ' + (workspace.github.openPRs ?? '—') + ' · ' + t('branch') + ' ' + String(workspace.github.branchProtected))
                  : null,
            ),
            workspace.rawScore !== undefined && workspace.rawScore !== workspace.score
              ? h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-state-error-primary)', marginTop: '4px' } }, t('p0Capped') + '：' + workspace.rawScore + ' → ' + workspace.score)
              : null,
            workspace.baseline && workspace.baseline.score !== null
              ? h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)', marginTop: '4px' } },
                  t('baselineDelta') + '：' + (workspace.baseline.delta >= 0 ? '+' : '') + workspace.baseline.delta +
                  (workspace.baseline.newRiskIds.length > 0 ? ' · ' + t('newRisks') + ' ' + workspace.baseline.newRiskIds.join(', ') : ''),
                )
              : null,
            (workspace.ignoredRisks && workspace.ignoredRisks.length > 0) || (workspace.acceptedRisks && workspace.acceptedRisks.length > 0)
              ? h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)', marginTop: '4px' } },
                  t('ignored') + ' ' + (workspace.ignoredRisks || []).length + ' · ' + t('accepted') + ' ' + (workspace.acceptedRisks || []).length +
                  ((workspace.acceptedRisks || []).length > 0 ? ' · ' + (workspace.acceptedRisks || []).map((risk) => risk.id + (risk.until ? ' ' + t('until') + ' ' + risk.until : '')).join(', ') : ''),
                )
              : null,
            Array.isArray(workspace.commands) && workspace.commands.length > 0
              ? h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)', marginTop: '4px' } }, t('commandsTitle') + '：' + workspace.commands.join(' · '))
              : null,
            h('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' } },
              Object.entries(workspace.dimensions || {}).map(([key, value]) => h('span', { key, style: { fontSize: '10px', padding: '1px 6px', borderRadius: '999px', background: 'var(--dsw-alias-bg-layer-2)' } }, key + ' ' + value)),
            ),
            h('div', { style: { marginTop: '10px' } },
              risks.length === 0 ? h('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-state-success-primary)' } }, t('noRisk')) : risks.map((risk, index) =>
                h('div', { key: index, style: { fontSize: '12px', marginTop: '4px', color: risk.severity === 'P0' ? 'var(--dsw-alias-state-error-primary)' : risk.severity === 'P1' ? 'var(--dsw-alias-state-warn-primary)' : 'var(--dsw-alias-label-secondary)' } }, '[' + risk.severity + '] ' + (isZh ? risk.text : (risk.en || risk.text))),
              ),
            ),
          );
        }),
        h('p', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, t('commands')),
      );
    }

    function SidebarIcon(props) {
      return h('svg', { width: props.size || 18, height: props.size || 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        h('path', { d: 'M4 19V5' }), h('path', { d: 'M4 12h5l2 3h9' }), h('path', { d: 'M9 7h5' }), h('path', { d: 'M9 10h7' }));
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'workspace-audit: dictionaries');
      const t = ctx.locale.bind(NS);
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, Panel));
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 22, label: () => t('panel'), locale: NS }, SidebarIcon));
    }

    return { inject: ['slots', 'locale', 'layout'], apply };
  },
});

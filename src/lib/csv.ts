// CSV 导入/导出工具
import type { Task, User, Project, Attachment } from '@/types';

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: '未开始',
  IN_PROGRESS: '处理中',
  IN_REVIEW: '待复核',
  NEEDS_INFO: '需补充',
  DONE: '已完成',
};

const RISK_LABELS: Record<string, string> = {
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};

const EXPORT_HEADERS = [
  '任务标题',
  '病例编号',
  '项目名称',
  '产品',
  '地区',
  '负责人',
  '状态',
  '风险',
  '截止日',
  '严重性',
  'MedDRA PT',
  '证据完整度',
  '随访轮次',
] as const;

/** 将 ISO 日期字符串格式化为 YYYY-MM-DD */
function formatDate(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** 转义 CSV 单元格：包含逗号、引号或换行时用双引号包裹，内部引号双写 */
function escapeCell(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** 取得今日日期 YYYY-MM-DD */
function todayStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 导出任务列表为 CSV 文件（带 UTF-8 BOM，兼容 Excel）。
 * @returns 生成的 CSV 字符串
 */
export function exportTasksToCSV(
  tasks: Task[],
  users: User[],
  projects: Project[],
  _attachments: Attachment[],
): string {
  const userMap = new Map(users.map((u) => [u.id, u]));
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const rows: string[] = [];
  rows.push(EXPORT_HEADERS.map(escapeCell).join(','));

  for (const task of tasks) {
    const project = task.projectId ? projectMap.get(task.projectId) : undefined;
    const assignee = task.assigneeId ? userMap.get(task.assigneeId) : undefined;

    const seriousnessLabel =
      task.seriousness === 'SERIOUS'
        ? '严重'
        : task.seriousness === 'NON_SERIOUS'
          ? '非严重'
          : '—';

    const evidenceCompleteness =
      task.requiredEvidence.length > 0
        ? `${task.evidenceUploaded.length}/${task.requiredEvidence.length}`
        : '—';

    const cells = [
      task.title ?? '',
      task.caseId ?? '',
      project?.name ?? '',
      project?.product ?? '',
      project?.region ?? '',
      assignee?.name ?? '',
      STATUS_LABELS[task.status] ?? task.status ?? '',
      RISK_LABELS[task.riskLevel] ?? task.riskLevel ?? '',
      formatDate(task.dueAt),
      seriousnessLabel,
      task.meddraPt ?? '',
      evidenceCompleteness,
      task.followUpRound ?? '',
    ];

    rows.push(cells.map(escapeCell).join(','));
  }

  const csv = `\uFEFF${rows.join('\r\n')}`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `PV任务导出_${todayStr()}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  return csv;
}

/**
 * 解析 CSV 文件为表头与行数据。
 * 支持 UTF-8 BOM、带引号的字段、\n 与 \r\n 换行。
 */
export async function parseCSVFile(
  file: File,
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const text = await file.text();

  // 去除 UTF-8 BOM
  const content = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const rows = parseCSV(content);
  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);
  const result: Record<string, string>[] = dataRows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      obj[header] = row[idx] ?? '';
    });
    return obj;
  });

  return { headers, rows: result };
}

/** 解析 CSV 文本为二维数组（支持引号包裹与 "" 转义） */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        // 双引号转义
        if (text[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        }
        // 引号结束
        inQuotes = false;
        i += 1;
        continue;
      }
      currentField += char;
      i += 1;
      continue;
    }

    // 未在引号内
    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (char === ',') {
      currentRow.push(currentField);
      currentField = '';
      i += 1;
      continue;
    }

    if (char === '\r') {
      // 处理 \r\n
      if (text[i + 1] === '\n') {
        i += 2;
      } else {
        i += 1;
      }
      currentRow.push(currentField);
      currentField = '';
      rows.push(currentRow);
      currentRow = [];
      continue;
    }

    if (char === '\n') {
      currentRow.push(currentField);
      currentField = '';
      rows.push(currentRow);
      currentRow = [];
      i += 1;
      continue;
    }

    currentField += char;
    i += 1;
  }

  // 处理最后一行/最后一个字段
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * 根据 CSV 表头自动映射到系统字段名。
 * 匹配规则：大小写不敏感，按 includes 判断。
 * @returns 键为 CSV 表头，值为系统字段名（未匹配则为 ''）
 */
export function autoMapColumns(headers: string[]): Record<string, string> {
  const rules: { keywords: string[]; field: string }[] = [
    { keywords: ['标题', 'title', '任务'], field: 'title' },
    { keywords: ['负责人', 'assignee'], field: 'assigneeId' },
    { keywords: ['截止', 'due', '日期'], field: 'dueAt' },
    { keywords: ['风险', 'risk'], field: 'riskLevel' },
    { keywords: ['项目', 'project'], field: 'projectId' },
    { keywords: ['描述', 'desc', '备注'], field: 'description' },
  ];

  const result: Record<string, string> = {};
  for (const header of headers) {
    const lower = header.toLowerCase();
    const matched = rules.find((rule) =>
      rule.keywords.some((kw) => lower.includes(kw.toLowerCase())),
    );
    result[header] = matched?.field ?? '';
  }
  return result;
}

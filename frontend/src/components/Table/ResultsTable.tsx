import { useMemo, useState } from 'react';
import { Table, Input, Button, Space, Tag, Card, Empty } from 'antd';
import { DownloadOutlined, FileTextOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useResultsStore } from '@/stores/useResultsStore';
import type { ResultRow } from '@/types/api';
import { toResultRows, exportResultsToXlsx, exportResultsToJson } from '@/utils/exportXlsx';
import { REGION_LABELS } from '@/utils/violationLabels';

/** Таблица результатов с сортировкой/фильтрацией/поиском — раздел 2.5, 2.6 ТЗ */
export function ResultsTable() {
  const history = useResultsStore((s) => s.history);
  const [search, setSearch] = useState('');

  const rows = useMemo(() => toResultRows(history), [history]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.study_uid.toLowerCase().includes(q) ||
        r.image_uid.toLowerCase().includes(q) ||
        r.path_to_study.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const columns: ColumnsType<ResultRow> = [
    {
      title: 'Путь / Study UID',
      dataIndex: 'path_to_study',
      key: 'path_to_study',
      ellipsis: true,
    },
    {
      title: 'Image UID',
      dataIndex: 'image_uid',
      key: 'image_uid',
      ellipsis: true,
      render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
    },
    {
      title: 'Область',
      dataIndex: 'anatomical_region',
      key: 'anatomical_region',
      filters: Object.entries(REGION_LABELS).map(([value, text]) => ({ text, value })),
      onFilter: (value, record) => record.anatomical_region === value,
      render: (v: string) => REGION_LABELS[v] ?? v,
    },
    {
      title: 'Качество',
      dataIndex: 'quality_class',
      key: 'quality_class',
      sorter: (a, b) => a.quality_class - b.quality_class,
      filters: [
        { text: 'Качественное', value: 0 },
        { text: 'Есть нарушение', value: 1 },
      ],
      onFilter: (value, record) => record.quality_class === value,
      render: (v: 0 | 1) =>
        v === 0 ? <Tag color="success">Качественное</Tag> : <Tag color="error">Нарушение</Tag>,
    },
    {
      title: 'Нарушения',
      dataIndex: 'violation_type',
      key: 'violation_type',
      ellipsis: true,
      render: (v: string) => v || '—',
    },
    {
      title: 'Статус',
      dataIndex: 'processing_status',
      key: 'processing_status',
      render: (v: string) => (
        <Tag color={v === 'Success' ? 'success' : 'error'}>{v}</Tag>
      ),
    },
    {
      title: 'Время, с',
      dataIndex: 'time_of_processing',
      key: 'time_of_processing',
      sorter: (a, b) => a.time_of_processing - b.time_of_processing,
      render: (v: number) => v.toFixed(2),
    },
  ];

  if (history.length === 0) {
    return (
      <Card>
        <Empty description="Пока нет обработанных исследований. Загрузите DICOM-файл, чтобы увидеть результаты." />
      </Card>
    );
  }

  return (
    <Card
      title="Таблица результатов"
      extra={
        <Space>
          <Button icon={<DownloadOutlined />} onClick={() => exportResultsToXlsx(history)}>
            Скачать XLSX
          </Button>
          <Button icon={<FileTextOutlined />} onClick={() => exportResultsToJson(history)}>
            Скачать JSON
          </Button>
        </Space>
      }
    >
      <Input
        placeholder="Поиск по Study UID / Image UID / пути"
        prefix={<SearchOutlined />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 16, maxWidth: 420 }}
        allowClear
      />
      <Table
        rowKey="image_uid"
        columns={columns}
        dataSource={filteredRows}
        rowClassName={(record) => (record.quality_class === 1 ? 'row-violation' : '')}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: true }}
      />
    </Card>
  );
}

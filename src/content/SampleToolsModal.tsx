import React, { useState, useEffect } from 'react';
import { Modal, Spin, Typography, Table, Alert, Tag, Button, Divider } from 'antd';
import { PrinterOutlined, EditOutlined } from '@ant-design/icons';
import type { TableProps, TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import type { LabelTemplate, LabelTemplates, SampleProperty } from '@shared/printTypes';
import { getLabelTemplates, setLabelTemplates } from '@shared/config';
import { LabelPreview, printLabels, TemplateEditor, TemplateList, createNewTemplate } from './print';

dayjs.extend(localizedFormat);

const { Text } = Typography;

interface SampleToolsModalProps {
  open: boolean;
  eid: string;
  onClose: () => void;
}

interface ColumnDef {
  key: string;
  title: string;
  type: string;
  readOnly: boolean;
}

interface RowData {
  _id: string;
  eid: string;
  [key: string]: unknown;
}

interface SampleTableData {
  cols: ColumnDef[];
  rows: RowData[];
}

interface EntityResponse {
  data: {
    link: string;
  };
  eid: string;
}

function extractLabel(value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    const obj = value as { auto?: string; value?: string };
    return obj.auto || obj.value || '-';
  }
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  return String(value);
}

function formatDate(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'auto' in value) {
    const dateStr = (value as { auto?: string }).auto;
    if (dateStr) {
      return dayjs(dateStr).format('LLL');
    }
  }
  if (typeof value === 'string') {
    return dayjs(value).format('LLL');
  }
  return '-';
}

const STATUS_COLORS: Record<string, string> = {
  Active: 'green',
  Closed: 'gray',
  Cancelled: 'orange',
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? 'default';
}

function labelSorter(key: string, extractor: (value: unknown) => string = extractLabel) {
  return (a: RowData, b: RowData) => extractor(a[key]).localeCompare(extractor(b[key]));
}

function createTextColumn(key: string, title: string): TableColumnsType<RowData>[number] {
  return {
    title,
    dataIndex: key,
    key,
    render: (value: unknown) => extractLabel(value),
    sorter: labelSorter(key),
  };
}

function createDateColumn(key: string, title: string): TableColumnsType<RowData>[number] {
  return {
    title,
    dataIndex: key,
    key,
    render: (value: unknown) => formatDate(value),
    sorter: labelSorter(key, formatDate),
  };
}

function createStatusColumn(
  key: string,
  title: string,
  statusOptions: string[],
): TableColumnsType<RowData>[number] {
  return {
    title,
    dataIndex: key,
    key,
    width: 120,
    render: (value: unknown) => {
      const status = extractLabel(value);
      return <Tag color={getStatusColor(status)}>{status}</Tag>;
    },
    sorter: labelSorter(key),
    filters: statusOptions.map((status) => ({ text: status, value: status })),
    onFilter: (value, record) => extractLabel(record[key]) === value,
  };
}

async function fetchEntity(eid: string): Promise<EntityResponse | null> {
  try {
    const baseUrl = window.location.origin;
    const response = await fetch(`${baseUrl}/api/v1.0/entities/${eid}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchSampleTableContent(link: string): Promise<SampleTableData | null> {
  try {
    const baseUrl = window.location.origin;
    const response = await fetch(`${baseUrl}${link}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchSampleProperties(): Promise<SampleProperty[]> {
  try {
    const baseUrl = window.location.origin;
    const response = await fetch(`${baseUrl}/api/v1.0/samples/property-types`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return data.properties || [];
  } catch {
    return [];
  }
}

function buildColumns(): TableColumnsType<RowData> {
  return [
    createTextColumn('sampleId', 'ID'),
    createDateColumn('1', 'Created Date'),
    createStatusColumn('Status', 'Status', ['Active', 'Closed', 'Cancelled']),
  ];
}

export const SampleToolsModal: React.FC<SampleToolsModalProps> = ({ open, eid, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState<SampleTableData | null>(null);
  const [properties, setProperties] = useState<SampleProperty[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Template state
  const [templates, setTemplates] = useState<LabelTemplates>({ templates: [] });
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (open && eid) {
      setLoading(true);
      setError(null);
      setTableData(null);
      setSelectedRowKeys([]);

      // Load templates
      getLabelTemplates().then((t) => {
        setTemplates(t);
        if (t.templates.length > 0 && !selectedTemplateId) {
          setSelectedTemplateId(t.templates[0].id);
        }
      });

      // Load data
      Promise.all([
        fetchEntity(eid).then((entity) => {
          if (!entity?.data?.link) return null;
          return fetchSampleTableContent(entity.data.link);
        }),
        fetchSampleProperties(),
      ])
        .then(([tableResult, props]) => {
          if (tableResult) {
            setTableData(tableResult);
            // Use table cols as fallback for properties
            if (props.length === 0 && tableResult.cols) {
              setProperties(
                tableResult.cols.map((col) => ({
                  key: col.key,
                  name: col.title,
                  type: col.type,
                })),
              );
            } else {
              setProperties(props);
            }
          } else {
            setError('Failed to load sample table');
          }
        })
        .catch(() => setError('Failed to load data'))
        .finally(() => setLoading(false));
    }
  }, [open, eid]);

  const selectedTemplate = templates.templates.find((t) => t.id === selectedTemplateId);
  const selectedSamples = tableData?.rows.filter((row) => selectedRowKeys.includes(row.eid)) || [];

  const handlePrint = async () => {
    if (!selectedTemplate || selectedSamples.length === 0) return;
    await printLabels({
      template: selectedTemplate,
      samples: selectedSamples,
      properties,
    });
  };

  const handleTemplateChange = (updated: LabelTemplate) => {
    const newTemplates = templates.templates.map((t) =>
      t.id === updated.id ? updated : t,
    );
    const newLabelTemplates = { templates: newTemplates };
    setTemplates(newLabelTemplates);
    setLabelTemplates(newLabelTemplates);
  };

  const handleAddTemplate = () => {
    if (templates.templates.length >= 5) return;
    const newTemplate = createNewTemplate();
    const newLabelTemplates = { templates: [...templates.templates, newTemplate] };
    setTemplates(newLabelTemplates);
    setLabelTemplates(newLabelTemplates);
    setSelectedTemplateId(newTemplate.id);
  };

  const handleDeleteTemplate = (id: string) => {
    const newTemplates = templates.templates.filter((t) => t.id !== id);
    const newLabelTemplates = { templates: newTemplates };
    setTemplates(newLabelTemplates);
    setLabelTemplates(newLabelTemplates);
    if (selectedTemplateId === id && newTemplates.length > 0) {
      setSelectedTemplateId(newTemplates[0].id);
    }
  };

  const handleDuplicateTemplate = (id: string) => {
    if (templates.templates.length >= 5) return;
    const original = templates.templates.find((t) => t.id === id);
    if (!original) return;
    const duplicate: LabelTemplate = {
      ...original,
      id: `tpl-${Date.now()}`,
      name: `${original.name} (copy)`,
    };
    const newLabelTemplates = { templates: [...templates.templates, duplicate] };
    setTemplates(newLabelTemplates);
    setLabelTemplates(newLabelTemplates);
    setSelectedTemplateId(duplicate.id);
  };

  const handleRenameTemplate = (id: string, name: string) => {
    const newTemplates = templates.templates.map((t) =>
      t.id === id ? { ...t, name } : t,
    );
    const newLabelTemplates = { templates: newTemplates };
    setTemplates(newLabelTemplates);
    setLabelTemplates(newLabelTemplates);
  };

  const handleReorderTemplates = (newTemplates: LabelTemplate[]) => {
    const newLabelTemplates = { templates: newTemplates };
    setTemplates(newLabelTemplates);
    setLabelTemplates(newLabelTemplates);
  };

  const rowSelection: TableProps<RowData>['rowSelection'] = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
  };

  // Edit mode: full-screen template editor
  if (editMode && selectedTemplate) {
    return (
      <Modal
        open={open}
        onCancel={() => setEditMode(false)}
        footer={null}
        title="Edit Template"
        width="100vw"
        style={{ top: 0, paddingBottom: 0, maxWidth: '100vw' }}
        styles={{ body: { height: 'calc(100vh - 110px)', overflow: 'auto' } }}
        destroyOnHidden
      >
        <TemplateEditor
          template={selectedTemplate}
          properties={properties}
          onChange={handleTemplateChange}
        />
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title="Sample Tools"
      width={1000}
      style={{ top: 20 }}
      destroyOnHidden
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
        </div>
      ) : error ? (
        <Alert
          type="error"
          title={error}
          description={<Text type="secondary">EID: {eid}</Text>}
        />
      ) : tableData ? (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">Sample Container: </Text>
            <Text code style={{ fontSize: 12, wordBreak: 'break-all' }}>{eid}</Text>
          </div>

          {/* Template Selection */}
          <div style={{ marginBottom: 16 }}>
            <TemplateList
              templates={templates.templates}
              selectedId={selectedTemplateId}
              onSelect={setSelectedTemplateId}
              onAdd={handleAddTemplate}
              onDelete={handleDeleteTemplate}
              onDuplicate={handleDuplicateTemplate}
              onRename={handleRenameTemplate}
              onReorder={handleReorderTemplates}
            />
          </div>

          {/* Template Preview */}
          {selectedTemplate && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  padding: 16,
                  background: '#fafafa',
                  borderRadius: 8,
                  display: 'inline-block',
                }}
              >
                <LabelPreview
                  template={selectedTemplate}
                  sampleData={tableData.rows[0] || {}}
                  properties={properties}
                />
              </div>
              <Button
                type="default"
                icon={<EditOutlined />}
                onClick={() => setEditMode(true)}
              >
                Edit Template
              </Button>
            </div>
          )}

          <Divider />

          {/* Sample Table */}
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">Total samples: </Text>
            <Text strong>{tableData.rows?.length || 0}</Text>
            {selectedRowKeys.length > 0 && (
              <Text type="secondary"> ({selectedRowKeys.length} selected)</Text>
            )}
          </div>

          <Table
            rowKey="eid"
            columns={buildColumns()}
            dataSource={tableData.rows}
            rowSelection={rowSelection}
            size="small"
            pagination={{ pageSize: 20, showSizeChanger: true }}
            scroll={{ y: 500 }}
          />

          {/* Print Button */}
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={handlePrint}
              disabled={selectedRowKeys.length === 0 || !selectedTemplate}
            >
              Print Labels ({selectedRowKeys.length})
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};

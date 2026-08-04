import React, { useState, useEffect } from 'react';
import { Modal, Spin, Typography, Table, Alert, Tag } from 'antd';
import type { TableProps, TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';

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

/**
 * Extracts a display label from a cell value.
 * API values can be either a plain scalar, or an object shaped like
 * `{ auto?: string; value?: string }`.
 */
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

/**
 * Formats a date-like cell value to local format.
 */
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

/** Sorter that compares two rows by a string label extracted from `key`. */
function labelSorter(key: string, extractor: (value: unknown) => string = extractLabel) {
  return (a: RowData, b: RowData) => extractor(a[key]).localeCompare(extractor(b[key]));
}

/** Column for plain text/id values, rendered and sorted as extracted labels. */
function createTextColumn(key: string, title: string): TableColumnsType<RowData>[number] {
  return {
    title,
    dataIndex: key,
    key,
    render: (value: unknown) => extractLabel(value),
    sorter: labelSorter(key),
  };
}

/** Column for date values, rendered via `formatDate` and sorted chronologically. */
function createDateColumn(key: string, title: string): TableColumnsType<RowData>[number] {
  return {
    title,
    dataIndex: key,
    key,
    render: (value: unknown) => formatDate(value),
    sorter: labelSorter(key, formatDate),
  };
}

/** Column for status values, rendered as a colored Tag with filter support. */
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

/**
 * Fetches entity data to get the content link.
 */
async function fetchEntity(eid: string): Promise<EntityResponse | null> {
  try {
    const baseUrl = window.location.origin;
    const response = await fetch(`${baseUrl}/api/v1.0/entities/${eid}`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[SNB Extension] Entity API error: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (e) {
    console.error('[SNB Extension] Error fetching entity:', e);
    return null;
  }
}

/**
 * Fetches sample table content from the link.
 */
async function fetchSampleTableContent(link: string): Promise<SampleTableData | null> {
  try {
    const baseUrl = window.location.origin;
    const response = await fetch(`${baseUrl}${link}`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[SNB Extension] Content API error: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (e) {
    console.error('[SNB Extension] Error fetching sample table:', e);
    return null;
  }
}

// Columns to display, in order, built via the per-type factories above.
function buildColumns(): TableColumnsType<RowData> {
  return [
    createTextColumn('sampleId', 'ID'),
    createDateColumn('1', 'Created Date'),
    createStatusColumn('Status', 'Status', ['Active', 'Closed', 'Cancelled']),
  ];
}

/**
 * Sample Tools Modal component using antd Table with row selection, filter, and sort.
 */
export const SampleToolsModal: React.FC<SampleToolsModalProps> = ({ open, eid, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState<SampleTableData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    if (open && eid) {
      setLoading(true);
      setError(null);
      setTableData(null);
      setSelectedRowKeys([]);

      // Step 1: Fetch entity to get link
      fetchEntity(eid)
        .then((entity) => {
          if (!entity?.data?.link) {
            setError('Failed to get entity link');
            return null;
          }
          // Step 2: Fetch sample table content
          return fetchSampleTableContent(entity.data.link);
        })
        .then((result) => {
          if (result) {
            setTableData(result);
          } else if (!error) {
            setError('Failed to load sample table');
          }
        })
        .catch(() => {
          setError('Failed to load data');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, eid]);

  // Define row selection (for future operations)
  const rowSelection: TableProps<RowData>['rowSelection'] = {
    selectedRowKeys,
    onChange: (keys) => {
      setSelectedRowKeys(keys);
      console.log('[SNB Extension] Selected samples:', keys);
    },
  };

  const columns = buildColumns();

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
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">Total samples: </Text>
            <Text strong>{tableData.rows?.length || 0}</Text>
            {selectedRowKeys.length > 0 && (
              <Text type="secondary"> ({selectedRowKeys.length} selected)</Text>
            )}
          </div>
          <Table
            rowKey="_id"
            columns={columns}
            dataSource={tableData.rows}
            rowSelection={rowSelection}
            size="small"
            pagination={{ pageSize: 20, showSizeChanger: true }}
            scroll={{ y: 500 }}
          />
        </div>
      ) : null}
    </Modal>
  );
};

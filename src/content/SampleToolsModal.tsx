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

// Columns to display (filter from API response)
const DISPLAY_COLUMNS = [
  { key: 'sampleId', title: 'ID' },
  { key: '1', title: 'Created Date' },
  { key: 'Status', title: 'Status' },
];

/**
 * Formats a date string to local format.
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

  // Build filtered table columns with filter and sort
  const columns: TableColumnsType<RowData> = DISPLAY_COLUMNS.map((displayCol) => {
    const isDateColumn = displayCol.key === '1';
    const isIdColumn = displayCol.key === 'sampleId';
    const isStatusColumn = displayCol.key === 'Status';

    return {
      title: displayCol.title,
      dataIndex: displayCol.key,
      key: displayCol.key,
      width: isStatusColumn ? 120 : undefined,
      render: (value: unknown) => {
        if (isDateColumn) {
          return formatDate(value);
        }
        // Handle object values (e.g., sampleId: { auto: "Sample-3681", value: "sample:xxx" })
        if (typeof value === 'object' && value !== null) {
          const obj = value as { auto?: string; value?: string };
          if (isStatusColumn) {
            const status = obj.auto || obj.value || '-';
            const color = status === 'Active' ? 'green' : status === 'Closed' ? 'red' : 'default';
            return <Tag color={color}>{status}</Tag>;
          }
          return obj.auto || obj.value || '-';
        }
        if (isStatusColumn) {
          const status = String(value);
          const color = status === 'Active' ? 'green' : status === 'Closed' ? 'red' : 'default';
          return <Tag color={color}>{status}</Tag>;
        }
        return value ?? '-';
      },
      sorter: isDateColumn
        ? (a, b) => {
          const aVal = a[displayCol.key];
          const bVal = b[displayCol.key];
          const aDate = formatDate(aVal);
          const bDate = formatDate(bVal);
          return aDate.localeCompare(bDate);
        }
        : isIdColumn || isStatusColumn
        ? (a, b) => {
          const getVal = (row: RowData) => {
            const v = row[displayCol.key];
            if (typeof v === 'object' && v !== null) {
              return (v as { auto?: string }).auto || '';
            }
            return String(v || '');
          };
          return getVal(a).localeCompare(getVal(b));
        }
        : undefined,
      filters: isStatusColumn
        ? [
            { text: 'Active', value: 'Active' },
            { text: 'Closed', value: 'Closed' },
          ]
        : undefined,
      onFilter: isStatusColumn
        ? (value, record) => {
            const v = record[displayCol.key];
            let status = '';
            if (typeof v === 'object' && v !== null) {
              status = (v as { auto?: string }).auto || '';
            } else {
              status = String(v || '');
            }
            return status === value;
          }
        : undefined,
    };
  });

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title="Sample Tools"
      width={1000}
      style={{ top: 20 }}
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
        </div>
      ) : error ? (
        <Alert
          type="error"
          message={error}
          description={<Text type="secondary">EID: {eid}</Text>}
        />
      ) : tableData ? (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">Container EID: </Text>
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
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Total ${total}` }}
            scroll={{ y: 500 }}
          />
        </div>
      ) : null}
    </Modal>
  );
};

import React, { useState, useEffect } from 'react';
import { Modal, Spin, Typography, Table, Alert } from 'antd';
import type { TableProps } from 'antd';

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
 * Sample Tools Modal component using antd Table with row selection.
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

  // Build table columns from cols definition
  const columns: TableProps<RowData>['columns'] = tableData?.cols?.map((col) => ({
    title: col.title,
    dataIndex: col.key,
    key: col.key,
    render: (value: { value?: string; auto?: string } | string) => {
      // Handle object values (e.g., sampleId: { auto: "Sample-3681", value: "sample:xxx" })
      if (typeof value === 'object' && value !== null) {
        return value.auto || value.value || '-';
      }
      return value ?? '-';
    },
  })) || [];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title="Sample Tools"
      width={900}
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
            <Text code>{eid}</Text>
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
            pagination={false}
            scroll={{ y: 400 }}
          />
        </div>
      ) : null}
    </Modal>
  );
};

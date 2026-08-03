import React, { useState, useEffect } from 'react';
import { Modal, Spin, Typography, List } from 'antd';

const { Text, Title } = Typography;

interface SampleToolsModalProps {
  open: boolean;
  eid: string;
  onClose: () => void;
}

interface Sample {
  id: string;
  name: string;
}

interface SamplesContainerData {
  eid: string;
  name: string;
  samples: Sample[];
}

/**
 * Fetches samplesContainer data from SNB API.
 */
async function fetchSamplesContainerData(eid: string): Promise<SamplesContainerData | null> {
  try {
    const baseUrl = window.location.origin;
    const response = await fetch(`${baseUrl}/api/rest/v1/samplesContainers/${eid}`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[SNB Extension] API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (e) {
    console.error('[SNB Extension] Error fetching samplesContainer:', e);
    return null;
  }
}

/**
 * Sample Tools Modal component using antd.
 */
export const SampleToolsModal: React.FC<SampleToolsModalProps> = ({ open, eid, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SamplesContainerData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && eid) {
      setLoading(true);
      setError(null);
      fetchSamplesContainerData(eid)
        .then((result) => {
          if (result) {
            setData(result);
          } else {
            setError('Failed to load data');
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

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title="Sample Tools"
      width={600}
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', color: '#999' }}>
          <p>{error}</p>
          <Text type="secondary" style={{ fontSize: 12 }}>
            EID: {eid}
          </Text>
        </div>
      ) : data ? (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Container EID
            </Text>
            <br />
            <Text code style={{ fontSize: 13 }}>
              {data.eid || eid}
            </Text>
          </div>

          <div style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Container Name
            </Text>
            <br />
            <Text>{data.name || 'N/A'}</Text>
          </div>

          <div style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Sample Count
            </Text>
            <br />
            <Title level={2} style={{ margin: 0 }}>
              {data.samples?.length || 0}
            </Title>
          </div>

          {data.samples && data.samples.length > 0 && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Samples
              </Text>
              <List
                size="small"
                style={{ marginTop: 8, maxHeight: 200, overflow: 'auto' }}
                dataSource={data.samples}
                renderItem={(sample) => (
                  <List.Item>
                    <Text>{sample.name || sample.id}</Text>
                  </List.Item>
                )}
              />
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
};

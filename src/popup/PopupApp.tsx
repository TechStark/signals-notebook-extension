import { useEffect, useState } from 'react';
import { Button, ConfigProvider, Flex, Tag, Typography } from 'antd';
import type { ExtensionConfig } from '@shared/config';

function PopupContent() {
  const [config, setConfig] = useState<ExtensionConfig | null>(null);

  useEffect(() => {
    void chrome.runtime.sendMessage({ type: 'GET_CONFIG' }).then(setConfig);
  }, []);

  if (!config) return null;

  return (
    <Flex vertical gap="small" style={{ padding: 12 }}>
      <Typography.Text strong>Signals Notebook Extension</Typography.Text>
      {config.snbHosts.length > 0 ? (
        <Flex gap="small" wrap>
          {config.snbHosts.map((host) => (
            <Tag key={host}>{host}</Tag>
          ))}
        </Flex>
      ) : (
        <Typography.Text type="secondary">No Signals Notebook host configured yet.</Typography.Text>
      )}
      <Button type="primary" block onClick={() => chrome.runtime.openOptionsPage()}>
        Open settings
      </Button>
    </Flex>
  );
}

export function PopupApp() {
  return (
    <ConfigProvider>
      <PopupContent />
    </ConfigProvider>
  );
}

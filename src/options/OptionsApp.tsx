import { useEffect, useState } from 'react';
import { App as AntdApp, Button, ConfigProvider, Empty, Flex, Input, List, Space, Typography } from 'antd';
import { getConfig, isValidSnbHost, setConfig } from '@shared/config';

function HostList({ hosts, onRemove }: { hosts: string[]; onRemove: (host: string) => void }) {
  if (hosts.length === 0) return <Empty description="No hosts configured yet" />;

  return (
    <List
      bordered
      dataSource={hosts}
      renderItem={(host) => (
        <List.Item actions={[<Button key="remove" danger type="link" onClick={() => onRemove(host)}>Remove</Button>]}>
          {host}
        </List.Item>
      )}
    />
  );
}

function AddHostForm({ existing, onAdded }: { existing: string[]; onAdded: (host: string) => void }) {
  const { message } = AntdApp.useApp();
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const host = value.trim().toLowerCase();

    if (!isValidSnbHost(host)) {
      message.error('Enter a valid host, e.g. my-instance.signalsresearch.revvitycloud.com or *.signalsresearch.revvitycloud.com');
      return;
    }
    if (existing.includes(host)) {
      message.error('That host is already added.');
      return;
    }

    setSubmitting(true);
    try {
      const granted = await chrome.runtime.sendMessage({ type: 'REQUEST_HOST_PERMISSION', host });
      if (!granted) {
        message.error('Permission denied — enhancements will not run on this domain.');
        return;
      }
      onAdded(host);
      setValue('');
      message.success('Saved.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Space.Compact style={{ width: '100%' }}>
      <Input
        placeholder="my-instance.signalsresearch.revvitycloud.com or *.signalsresearch.revvitycloud.com"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onPressEnter={handleSubmit}
      />
      <Button type="primary" loading={submitting} onClick={handleSubmit}>
        Add
      </Button>
    </Space.Compact>
  );
}

function OptionsPage() {
  const [hosts, setHosts] = useState<string[] | null>(null);

  useEffect(() => {
    void getConfig().then((config) => setHosts(config.snbHosts));
  }, []);

  if (hosts === null) return null;

  const persist = async (next: string[]) => {
    setHosts(next);
    await setConfig({ snbHosts: next });
  };

  return (
    <Flex vertical gap="middle" style={{ maxWidth: 480, margin: '40px auto' }}>
      <Typography.Title level={3}>Signals Notebook Extension</Typography.Title>
      <Typography.Paragraph type="secondary">
        Add the Signals Notebook hosts where enhancements should run. Use a subdomain wildcard (e.g.{' '}
        <Typography.Text code>*.signalsresearch.revvitycloud.com</Typography.Text>) to cover every instance under one domain.
      </Typography.Paragraph>
      <AddHostForm existing={hosts} onAdded={(host) => void persist([...hosts, host])} />
      <HostList hosts={hosts} onRemove={(host) => void persist(hosts.filter((h) => h !== host))} />
    </Flex>
  );
}

export function OptionsApp() {
  return (
    <ConfigProvider>
      <AntdApp>
        <OptionsPage />
      </AntdApp>
    </ConfigProvider>
  );
}

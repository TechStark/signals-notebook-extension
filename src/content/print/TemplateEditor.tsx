import React, { useState, useCallback } from 'react';
import { Button, Input, InputNumber, Space, Select, Typography, Card, Dropdown } from 'antd';
import { DeleteOutlined, SettingOutlined, PlusOutlined, CopyOutlined, MoreOutlined } from '@ant-design/icons';
import type { LabelTemplate, TemplateElement, SampleProperty, ElementType } from '@shared/printTypes';
import { DEFAULT_TEMPLATE, generateTemplateId } from '@shared/printTypes';

const { Text } = Typography;

interface TemplateEditorProps {
  template: LabelTemplate;
  properties: SampleProperty[];
  onChange: (template: LabelTemplate) => void;
}

/** Creates a default element for a given type. */
function createDefaultElement(type: ElementType, row: number, col: number): TemplateElement {
  const base = { row, col, rowSpan: 1, colSpan: 1 };

  switch (type) {
    case 'field':
      return { ...base, type: 'field', propertyName: '', propertyType: '' };
    case 'qrCode':
      return { ...base, type: 'qrCode', contentTemplate: '{ID}' };
    case 'barcode':
      return { ...base, type: 'barcode', contentTemplate: '{ID}' };
    case 'staticText':
      return { ...base, type: 'staticText', content: 'Label' };
  }
}

/**
 * Full-screen template editor with grid canvas and property panel.
 */
export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  properties,
  onChange,
}) => {
  const [selectedElementIndex, setSelectedElementIndex] = useState<number | null>(null);
  const [dragToAdd, setDragToAdd] = useState<ElementType | null>(null);

  const updateTemplate = useCallback(
    (updates: Partial<LabelTemplate>) => {
      onChange({ ...template, ...updates });
    },
    [template, onChange],
  );

  const updateElement = useCallback(
    (index: number, updates: Partial<TemplateElement>) => {
      const newElements = [...template.elements];
      newElements[index] = { ...newElements[index], ...updates } as TemplateElement;
      updateTemplate({ elements: newElements });
    },
    [template.elements, updateTemplate],
  );

  const addElement = useCallback(
    (type: ElementType, row: number, col: number) => {
      const newElement = createDefaultElement(type, row, col);
      updateTemplate({ elements: [...template.elements, newElement] });
      setSelectedElementIndex(template.elements.length);
    },
    [template.elements, updateTemplate],
  );

  const deleteElement = useCallback(
    (index: number) => {
      const newElements = template.elements.filter((_, i) => i !== index);
      updateTemplate({ elements: newElements });
      if (selectedElementIndex === index) {
        setSelectedElementIndex(null);
      }
    },
    [template.elements, selectedElementIndex, updateTemplate],
  );

  const selectedElement = selectedElementIndex !== null ? template.elements[selectedElementIndex] : null;

  return (
    <div style={{ display: 'flex', height: '100%', gap: 16 }}>
      {/* Left Panel: Properties (Draggable) */}
      <Card
        title="Available Fields"
        style={{ width: 200, overflow: 'auto' }}
        styles={{ body: { padding: 8 } }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {properties.map((prop) => (
            <div
              key={prop.key}
              draggable
              onDragStart={() => setDragToAdd('field')}
              onDragEnd={() => setDragToAdd(null)}
              style={{
                padding: '4px 8px',
                border: '1px solid #d9d9d9',
                borderRadius: 4,
                cursor: 'grab',
                fontSize: 12,
              }}
            >
              <Text>{prop.name}</Text>
              <Text type="secondary" style={{ marginLeft: 4 }}>({prop.type})</Text>
            </div>
          ))}
        </Space>
      </Card>

      {/* Center: Grid Canvas */}
      <Card
        title={
          <Space>
            <Input
              value={template.name}
              onChange={(e) => updateTemplate({ name: e.target.value })}
              placeholder="Template Name"
              style={{ width: 200 }}
            />
          </Space>
        }
        extra={
          <Space>
            <Text>Width:</Text>
            <InputNumber
              value={template.width}
              onChange={(v) => updateTemplate({ width: v || 50 })}
              min={10}
              max={200}
              suffix="mm"
              size="small"
            />
            <Text>Height:</Text>
            <InputNumber
              value={template.height}
              onChange={(v) => updateTemplate({ height: v || 25 })}
              min={10}
              max={100}
              suffix="mm"
              size="small"
            />
            <Text>Rows:</Text>
            <InputNumber
              value={template.rows}
              onChange={(v) => updateTemplate({ rows: v || 4 })}
              min={1}
              max={20}
              size="small"
            />
            <Text>Cols:</Text>
            <InputNumber
              value={template.cols}
              onChange={(v) => updateTemplate({ cols: v || 3 })}
              min={1}
              max={10}
              size="small"
            />
          </Space>
        }
        style={{ flex: 1 }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${template.cols}, 1fr)`,
            gridTemplateRows: `repeat(${template.rows}, 40px)`,
            gap: 2,
            background: '#f5f5f5',
            padding: 8,
            border: '1px solid #d9d9d9',
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const cellWidth = rect.width / template.cols;
            const cellHeight = rect.height / template.rows;
            const col = Math.floor(x / cellWidth);
            const row = Math.floor(y / cellHeight);
            if (dragToAdd && col >= 0 && col < template.cols && row >= 0 && row < template.rows) {
              addElement(dragToAdd, row, col);
            }
          }}
        >
          {Array.from({ length: template.rows * template.cols }).map((_, index) => {
            const row = Math.floor(index / template.cols);
            const col = index % template.cols;
            const element = template.elements.find(
              (el) =>
                el.row <= row &&
                row < el.row + el.rowSpan &&
                el.col <= col &&
                col < el.col + el.colSpan &&
                el.row === row &&
                el.col === col,
            );

            if (element) {
              const elIndex = template.elements.indexOf(element);
              const isSelected = elIndex === selectedElementIndex;
              return (
                <div
                  key={index}
                  onClick={() => setSelectedElementIndex(elIndex)}
                  style={{
                    gridColumn: `${element.col + 1} / span ${element.colSpan}`,
                    gridRow: `${element.row + 1} / span ${element.rowSpan}`,
                    background: isSelected ? '#e6f7ff' : '#fff',
                    border: `1px solid ${isSelected ? '#1890ff' : '#d9d9d9'}`,
                    borderRadius: 4,
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: 10,
                    overflow: 'hidden',
                  }}
                >
                  {element.type === 'field' ? `[${element.propertyName || 'Field'}]` :
                   element.type === 'qrCode' ? '[QR]' :
                   element.type === 'barcode' ? '[Barcode]' :
                   element.type === 'staticText' ? element.content : ''}
                </div>
              );
            }

            return (
              <div
                key={index}
                style={{
                  background: '#fafafa',
                  border: '1px dashed #d9d9d9',
                  borderRadius: 4,
                }}
              />
            );
          })}
        </div>
      </Card>

      {/* Right Panel: Element Properties */}
      <Card
        title={selectedElement ? 'Element Properties' : 'Add Element'}
        style={{ width: 250 }}
        styles={{ body: { padding: 8 } }}
      >
        {selectedElement ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => deleteElement(selectedElementIndex!)}
            >
              Delete Element
            </Button>

            <Text strong>Type: {selectedElement.type}</Text>

            <Space>
              <Text>Row:</Text>
              <InputNumber
                value={selectedElement.row}
                onChange={(v) => updateElement(selectedElementIndex!, { row: v ?? 0 })}
                min={0}
                max={template.rows - 1}
                size="small"
              />
            </Space>

            <Space>
              <Text>Col:</Text>
              <InputNumber
                value={selectedElement.col}
                onChange={(v) => updateElement(selectedElementIndex!, { col: v ?? 0 })}
                min={0}
                max={template.cols - 1}
                size="small"
              />
            </Space>

            <Space>
              <Text>Row Span:</Text>
              <InputNumber
                value={selectedElement.rowSpan}
                onChange={(v) => updateElement(selectedElementIndex!, { rowSpan: v ?? 1 })}
                min={1}
                max={template.rows - selectedElement.row}
                size="small"
              />
            </Space>

            <Space>
              <Text>Col Span:</Text>
              <InputNumber
                value={selectedElement.colSpan}
                onChange={(v) => updateElement(selectedElementIndex!, { colSpan: v ?? 1 })}
                min={1}
                max={template.cols - selectedElement.col}
                size="small"
              />
            </Space>

            {selectedElement.type === 'field' && (
              <>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text>Property:</Text>
                  <Select
                    value={selectedElement.propertyName}
                    onChange={(v) => {
                      const prop = properties.find((p) => p.name === v);
                      if (prop) {
                        updateElement(selectedElementIndex!, { propertyName: v, propertyType: prop.type });
                      }
                    }}
                    options={properties.map((p) => ({ value: p.name, label: p.name }))}
                    style={{ width: '100%' }}
                    size="small"
                  />
                </Space>
              </>
            )}

            {(selectedElement.type === 'qrCode' || selectedElement.type === 'barcode') && (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>Content Template:</Text>
                <Input
                  value={(selectedElement as { contentTemplate: string }).contentTemplate}
                  onChange={(e) => updateElement(selectedElementIndex!, { contentTemplate: e.target.value } as TemplateElement)}
                  placeholder="{ID}"
                  size="small"
                />
              </Space>
            )}

            {selectedElement.type === 'staticText' && (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>Content:</Text>
                <Input
                  value={selectedElement.content}
                  onChange={(e) => updateElement(selectedElementIndex!, { content: e.target.value })}
                  size="small"
                />
              </Space>
            )}

            {(selectedElement.type === 'field' || selectedElement.type === 'staticText') && (
              <>
                <Select
                  value={selectedElement.fontSize || 'medium'}
                  onChange={(v) => updateElement(selectedElementIndex!, { fontSize: v })}
                  options={[
                    { value: 'small', label: 'Small' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'large', label: 'Large' },
                  ]}
                  style={{ width: '100%' }}
                  size="small"
                />
                <Select
                  value={selectedElement.align || 'left'}
                  onChange={(v) => updateElement(selectedElementIndex!, { align: v })}
                  options={[
                    { value: 'left', label: 'Left' },
                    { value: 'center', label: 'Center' },
                    { value: 'right', label: 'Right' },
                  ]}
                  style={{ width: '100%' }}
                  size="small"
                />
                <Select
                  value={selectedElement.bold ? 'bold' : 'normal'}
                  onChange={(v) => updateElement(selectedElementIndex!, { bold: v === 'bold' })}
                  options={[
                    { value: 'normal', label: 'Normal' },
                    { value: 'bold', label: 'Bold' },
                  ]}
                  style={{ width: '100%' }}
                  size="small"
                />
              </>
            )}
          </Space>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text type="secondary">Add new element:</Text>
            <Button block size="small" onClick={() => addElement('field', 0, 0)}>
              + Field
            </Button>
            <Button block size="small" onClick={() => addElement('qrCode', 0, 0)}>
              + QR Code
            </Button>
            <Button block size="small" onClick={() => addElement('barcode', 0, 0)}>
              + Barcode
            </Button>
            <Button block size="small" onClick={() => addElement('staticText', 0, 0)}>
              + Static Text
            </Button>
          </Space>
        )}
      </Card>
    </div>
  );
};

interface TemplateListProps {
  templates: LabelTemplate[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onReorder: (templates: LabelTemplate[]) => void;
}

/**
 * Template list with management actions.
 */
export const TemplateList: React.FC<TemplateListProps> = ({
  templates,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
  onDuplicate,
  onRename,
  onReorder,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  return (
    <Space wrap style={{ width: '100%', marginBottom: 16 }}>
      {templates.map((tpl, index) => (
        <div key={tpl.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {editingId === tpl.id ? (
            <Input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={() => {
                if (editingName.trim()) {
                  onRename(tpl.id, editingName.trim());
                }
                setEditingId(null);
              }}
              onPressEnter={() => {
                if (editingName.trim()) {
                  onRename(tpl.id, editingName.trim());
                }
                setEditingId(null);
              }}
              autoFocus
              size="small"
              style={{ width: 120 }}
            />
          ) : (
            <Button
              type={selectedId === tpl.id ? 'primary' : 'default'}
              onClick={() => onSelect(tpl.id)}
              size="small"
            >
              {tpl.name}
            </Button>
          )}
          <Dropdown
            menu={{
              items: [
                { key: 'rename', label: 'Rename', icon: <SettingOutlined /> },
                { key: 'duplicate', label: 'Duplicate', icon: <CopyOutlined /> },
                { key: 'delete', label: 'Delete', icon: <DeleteOutlined />, danger: true },
                ...(templates.length > 1 ? [
                  { type: 'divider' as const },
                  { key: 'moveUp', label: 'Move Up', disabled: index === 0 },
                  { key: 'moveDown', label: 'Move Down', disabled: index === templates.length - 1 },
                ] : []),
              ],
              onClick: ({ key }) => {
                switch (key) {
                  case 'rename':
                    setEditingId(tpl.id);
                    setEditingName(tpl.name);
                    break;
                  case 'duplicate':
                    onDuplicate(tpl.id);
                    break;
                  case 'delete':
                    if (templates.length > 1) {
                      onDelete(tpl.id);
                    }
                    break;
                  case 'moveUp':
                    if (index > 0) {
                      const newTemplates = [...templates];
                      [newTemplates[index - 1], newTemplates[index]] = [newTemplates[index], newTemplates[index - 1]];
                      onReorder(newTemplates);
                    }
                    break;
                  case 'moveDown':
                    if (index < templates.length - 1) {
                      const newTemplates = [...templates];
                      [newTemplates[index], newTemplates[index + 1]] = [newTemplates[index + 1], newTemplates[index]];
                      onReorder(newTemplates);
                    }
                    break;
                }
              },
            }}
          >
            <Button size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </div>
      ))}
      <Button
        size="small"
        type="dashed"
        icon={<PlusOutlined />}
        onClick={onAdd}
        disabled={templates.length >= 5}
      >
        New
      </Button>
    </Space>
  );
};

export const createNewTemplate = (): LabelTemplate => ({
  ...DEFAULT_TEMPLATE,
  id: generateTemplateId(),
  name: `Template ${Date.now().toString(36)}`,
});

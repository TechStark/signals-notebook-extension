import React, { useState, useCallback, useRef } from 'react';
import { Button, Input, InputNumber, Select, Typography, Card, Space } from 'antd';
import { DeleteOutlined, PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import type { LabelTemplate, TemplateElement, SampleProperty, DataSource, ElementType } from '@shared/printTypes';
import { DEFAULT_TEMPLATE, generateTemplateId, generateTemplateName, createDefaultElements, USER_FIELDS } from '@shared/printTypes';

const { Text } = Typography;

interface TemplateEditorProps {
  template: LabelTemplate;
  properties: SampleProperty[];
  onChange: (template: LabelTemplate) => void;
}

/** Creates a default element for a given type. */
function createDefaultElement(type: ElementType): TemplateElement {
  switch (type) {
    case 'field':
      return { type: 'field', source: 'sample', fieldName: '', fieldType: '', row: 0, col: 0, rowSpan: 1, colSpan: 1 };
    case 'qrCode':
      return { type: 'qrCode', contentTemplate: '{ID}', row: 0, col: 0, rowSpan: 1, colSpan: 1 };
    case 'barcode':
      return { type: 'barcode', contentTemplate: '{ID}', row: 0, col: 0, rowSpan: 1, colSpan: 1 };
    case 'staticText':
      return { type: 'staticText', content: 'Label', row: 0, col: 0, rowSpan: 1, colSpan: 1 };
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
  const [showAddPanel, setShowAddPanel] = useState(true);
  const [dragState, setDragState] = useState<{
    index: number;
    startX: number;
    startY: number;
    startRow: number;
    startCol: number;
  } | null>(null);
  const [resizeState, setResizeState] = useState<{
    index: number;
    startRowSpan: number;
    startColSpan: number;
    startX: number;
    startY: number;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

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
    (type: ElementType) => {
      // Find first empty cell
      const occupied = new Set<string>();
      template.elements.forEach((el) => {
        for (let r = el.row; r < el.row + el.rowSpan; r++) {
          for (let c = el.col; c < el.col + el.colSpan; c++) {
            occupied.add(`${r},${c}`);
          }
        }
      });

      let row = 0, col = 0;
      outer: for (let r = 0; r < template.rows; r++) {
        for (let c = 0; c < template.cols; c++) {
          if (!occupied.has(`${r},${c}`)) {
            row = r;
            col = c;
            break outer;
          }
        }
      }

      const newElement = { ...createDefaultElement(type), row, col };
      updateTemplate({ elements: [...template.elements, newElement] });
      setSelectedElementIndex(template.elements.length);
      setShowAddPanel(false);
    },
    [template, updateTemplate],
  );

  const deleteElement = useCallback(
    (index: number) => {
      const newElements = template.elements.filter((_, i) => i !== index);
      updateTemplate({ elements: newElements });
      if (selectedElementIndex === index) {
        setSelectedElementIndex(null);
        setShowAddPanel(true);
      }
    },
    [template.elements, selectedElementIndex, updateTemplate],
  );

  // Handle drag start (for repositioning)
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    setDragState({
      index,
      startX: e.clientX,
      startY: e.clientY,
      startRow: template.elements[index].row,
      startCol: template.elements[index].col,
    });
  };

  // Handle drop on canvas
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragState || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const cellWidth = rect.width / template.cols;
    const cellHeight = rect.height / template.rows;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newCol = Math.min(Math.max(0, Math.floor(x / cellWidth)), template.cols - 1);
    const newRow = Math.min(Math.max(0, Math.floor(y / cellHeight)), template.rows - 1);

    // Check if position is valid (not overlapping)
    const el = template.elements[dragState.index];
    const wouldOverlap = template.elements.some((other, i) => {
      if (i === dragState.index) return false;
      return (
        newRow < other.row + other.rowSpan &&
        newRow + el.rowSpan > other.row &&
        newCol < other.col + other.colSpan &&
        newCol + el.colSpan > other.col
      );
    });

    if (!wouldOverlap) {
      updateElement(dragState.index, { row: newRow, col: newCol });
    }
    setDragState(null);
  };

  // Handle resize
  const handleResizeStart = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const el = template.elements[index];
    setResizeState({
      index,
      startRowSpan: el.rowSpan,
      startColSpan: el.colSpan,
      startX: e.clientX,
      startY: e.clientY,
    });
  };

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizeState || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cellWidth = rect.width / template.cols;
    const cellHeight = rect.height / template.rows;
    const deltaX = e.clientX - resizeState.startX;
    const deltaY = e.clientY - resizeState.startY;
    const deltaCols = Math.round(deltaX / cellWidth);
    const deltaRows = Math.round(deltaY / cellHeight);
    const newColSpan = Math.max(1, Math.min(template.cols - template.elements[resizeState.index].col, resizeState.startColSpan + deltaCols));
    const newRowSpan = Math.max(1, Math.min(template.rows - template.elements[resizeState.index].row, resizeState.startRowSpan + deltaRows));
    updateElement(resizeState.index, { colSpan: newColSpan, rowSpan: newRowSpan });
  }, [resizeState, template, updateElement, canvasRef]);

  const handleResizeEnd = useCallback(() => {
    setResizeState(null);
  }, []);

  React.useEffect(() => {
    if (resizeState) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizeState, handleResizeMove, handleResizeEnd]);

  const selectedElement = selectedElementIndex !== null ? template.elements[selectedElementIndex] : null;

  // Calculate canvas size based on aspect ratio
  // Use a max width and calculate height proportionally
  const maxCanvasWidth = 600;
  const aspectRatio = template.width / template.height;
  const canvasWidth = maxCanvasWidth;
  const canvasHeight = maxCanvasWidth / aspectRatio;

  return (
    <div style={{ display: 'flex', height: '100%', gap: 16 }}>
      {/* Left side: Grid canvas */}
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
              onChange={(v) => updateTemplate({ rows: v || 2 })}
              min={1}
              max={20}
              size="small"
            />
            <Text>Cols:</Text>
            <InputNumber
              value={template.cols}
              onChange={(v) => updateTemplate({ cols: v || 2 })}
              min={1}
              max={10}
              size="small"
            />
          </Space>
        }
        style={{ flex: 1 }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <div
            ref={canvasRef}
            style={{
              width: canvasWidth,
              height: canvasHeight,
              display: 'grid',
              gridTemplateColumns: `repeat(${template.cols}, 1fr)`,
              gridTemplateRows: `repeat(${template.rows}, 1fr)`,
              gap: 1,
              background: '#d9d9d9',
              border: '1px solid #bbb',
              borderRadius: 4,
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleCanvasDrop}
            onClick={() => {
              setSelectedElementIndex(null);
              setShowAddPanel(true);
            }}
          >
            {/* Grid cells for empty areas */}
            {Array.from({ length: template.rows * template.cols }).map((_, cellIndex) => {
              const cellRow = Math.floor(cellIndex / template.cols);
              const cellCol = cellIndex % template.cols;
              const elementAtCell = template.elements.find(
                (el) =>
                  cellRow >= el.row &&
                  cellRow < el.row + el.rowSpan &&
                  cellCol >= el.col &&
                  cellCol < el.col + el.colSpan
              );
              if (elementAtCell) return null;
              return (
                <div
                  key={`empty-${cellIndex}`}
                  style={{
                    background: '#fafafa',
                    borderRadius: 2,
                  }}
                />
              );
            })}
            {template.elements.map((element, index) => {
              const isSelected = index === selectedElementIndex;
              const isDragging = dragState?.index === index;
              return (
                <div
                  key={`element-${index}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedElementIndex(index);
                    setShowAddPanel(false);
                  }}
                  style={{
                    gridColumn: `${element.col + 1} / span ${element.colSpan}`,
                    gridRow: `${element.row + 1} / span ${element.rowSpan}`,
                    background: isSelected ? '#e6f7ff' : '#fff',
                    border: `2px solid ${isSelected ? '#1890ff' : '#d9d9d9'}`,
                    borderRadius: 4,
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'move',
                    fontSize: 12,
                    overflow: 'hidden',
                    position: 'relative',
                    opacity: isDragging ? 0.5 : 1,
                  }}
                >
                  {element.type === 'field' ? `[${element.fieldName || 'Field'}]` :
                   element.type === 'qrCode' ? '[QR]' :
                   element.type === 'barcode' ? '[Barcode]' :
                   element.type === 'staticText' ? element.content : ''}
                  {/* Resize handle */}
                  {isSelected && (
                    <div
                      onMouseDown={(e) => handleResizeStart(e, index)}
                      style={{
                        position: 'absolute',
                        right: 0,
                        bottom: 0,
                        width: 16,
                        height: 16,
                        cursor: 'se-resize',
                        background: 'linear-gradient(135deg, transparent 50%, #1890ff 50%)',
                        borderRadius: '0 0 4px 0',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Right side: Add Element / Property panel */}
      <Card
        title={showAddPanel || !selectedElement ? 'Add Element' : 'Element Properties'}
        style={{ width: 280 }}
        bodyStyle={{ padding: 12 }}
      >
        {showAddPanel || !selectedElement ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button block onClick={() => addElement('field')}>+ Field</Button>
            <Button block onClick={() => addElement('qrCode')}>+ QR Code</Button>
            <Button block onClick={() => addElement('barcode')}>+ Barcode</Button>
            <Button block onClick={() => addElement('staticText')}>+ Static Text</Button>
          </Space>
        ) : selectedElementIndex !== null ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            {/* Back to Add panel button */}
            <Button block icon={<ArrowLeftOutlined />} onClick={() => setShowAddPanel(true)}>
              Add Element
            </Button>

            {/* Delete button */}
            <Button
              danger
              block
              icon={<DeleteOutlined />}
              onClick={() => deleteElement(selectedElementIndex)}
            >
              Delete
            </Button>

            {/* Position */}
            <Card size="small" title="Position">
              <Space>
                <Text>Row:</Text>
                <InputNumber
                  value={selectedElement.row}
                  onChange={(v) => updateElement(selectedElementIndex!, { row: v ?? 0 })}
                  min={0}
                  max={template.rows - 1}
                  size="small"
                />
                <Text>Col:</Text>
                <InputNumber
                  value={selectedElement.col}
                  onChange={(v) => updateElement(selectedElementIndex!, { col: v ?? 0 })}
                  min={0}
                  max={template.cols - 1}
                  size="small"
                />
              </Space>
            </Card>

            {/* Size */}
            <Card size="small" title="Size">
              <Space>
                <Text>Row Span:</Text>
                <InputNumber
                  value={selectedElement.rowSpan}
                  onChange={(v) => updateElement(selectedElementIndex!, { rowSpan: v ?? 1 })}
                  min={1}
                  max={template.rows - selectedElement.row}
                  size="small"
                />
                <Text>Col Span:</Text>
                <InputNumber
                  value={selectedElement.colSpan}
                  onChange={(v) => updateElement(selectedElementIndex!, { colSpan: v ?? 1 })}
                  min={1}
                  max={template.cols - selectedElement.col}
                  size="small"
                />
              </Space>
            </Card>

            {/* Content - Field */}
            {selectedElement.type === 'field' && (
              <Card size="small" title="Content">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div><Text>Source:</Text></div>
                  <Select
                    value={selectedElement.source}
                    onChange={(v) => {
                      updateElement(selectedElementIndex!, {
                        source: v as DataSource,
                        fieldName: '',
                        fieldType: '',
                      } as TemplateElement);
                    }}
                    options={[
                      { value: 'sample', label: 'Sample' },
                      { value: 'user', label: 'User' },
                    ]}
                    style={{ width: '100%' }}
                    size="small"
                  />
                  <div><Text>Field:</Text></div>
                  <Select
                    value={selectedElement.fieldName}
                    onChange={(v) => {
                      const selectedSource = selectedElement.source;
                      if (selectedSource === 'sample') {
                        const prop = properties.find((p) => p.name === v);
                        updateElement(selectedElementIndex!, { fieldName: v, fieldType: prop?.type || 'text' });
                      } else {
                        updateElement(selectedElementIndex!, { fieldName: v, fieldType: 'text' });
                      }
                    }}
                    options={
                      selectedElement.source === 'user'
                        ? USER_FIELDS.map((f) => ({ value: f, label: f }))
                        : properties.map((p) => ({ value: p.name, label: p.name }))
                    }
                    style={{ width: '100%' }}
                    size="small"
                  />
                </Space>
              </Card>
            )}

            {/* Content - QR/Barcode */}
            {(selectedElement.type === 'qrCode' || selectedElement.type === 'barcode') && (
              <Card size="small" title="Content">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div><Text>Template:</Text></div>
                  <Input
                    value={(selectedElement as { contentTemplate: string }).contentTemplate}
                    onChange={(e) => updateElement(selectedElementIndex!, { contentTemplate: e.target.value } as TemplateElement)}
                    placeholder="{ID}"
                    size="small"
                  />
                </Space>
              </Card>
            )}

            {/* Content - Static Text */}
            {selectedElement.type === 'staticText' && (
              <Card size="small" title="Content">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div><Text>Text:</Text></div>
                  <Input
                    value={selectedElement.content}
                    onChange={(e) => updateElement(selectedElementIndex!, { content: e.target.value })}
                    size="small"
                  />
                </Space>
              </Card>
            )}

            {/* Style */}
            {(selectedElement.type === 'field' || selectedElement.type === 'staticText') && (
              <Card size="small" title="Style">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div><Text>Font Size:</Text></div>
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
                  <div><Text>Align:</Text></div>
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
                  <div><Text>Bold:</Text></div>
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
                </Space>
              </Card>
            )}
          </Space>
        ) : null}
      </Card>
    </div>
  );
};

interface TemplateListProps {
  templates: LabelTemplate[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export const TemplateList: React.FC<TemplateListProps> = ({
  templates,
  selectedId,
  onSelect,
  onAdd,
}) => {
  return (
    <Space wrap style={{ width: '100%', marginBottom: 8 }}>
      {templates.map((tpl) => (
        <Button
          key={tpl.id}
          type={selectedId === tpl.id ? 'primary' : 'default'}
          onClick={() => onSelect(tpl.id)}
          size="small"
        >
          {tpl.name}
        </Button>
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

export const createNewTemplate = (existingCount: number): LabelTemplate => ({
  ...DEFAULT_TEMPLATE,
  id: generateTemplateId(),
  name: generateTemplateName(existingCount),
  elements: createDefaultElements(),
});

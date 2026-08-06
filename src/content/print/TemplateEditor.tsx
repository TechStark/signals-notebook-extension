import React, { useState, useCallback, useRef } from 'react';
import { Button, Input, InputNumber, Select, Typography, Card, Space } from 'antd';
import { DeleteOutlined, PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import type { LabelTemplate, TemplateElement, SampleProperty, DataSource, ElementType, ContentPart } from '@shared/printTypes';
import { DEFAULT_TEMPLATE, generateTemplateId, generateTemplateName, createDefaultElements, USER_FIELDS } from '@shared/printTypes';

const { Text } = Typography;

interface ContentPartsEditorProps {
  parts: ContentPart[];
  properties: SampleProperty[];
  onChange: (parts: ContentPart[]) => void;
}

/** Editor for QR/Barcode content parts. */
const ContentPartsEditor: React.FC<ContentPartsEditorProps> = ({
  parts,
  properties,
  onChange,
}) => {
  const addStaticText = () => {
    onChange([...parts, { type: 'staticText', content: '' }]);
  };

  const addField = () => {
    onChange([...parts, { type: 'field', source: 'sample', fieldName: '' }]);
  };

  const updatePart = (index: number, updates: Partial<ContentPart>) => {
    const newParts = [...parts];
    newParts[index] = { ...newParts[index], ...updates } as ContentPart;
    onChange(newParts);
  };

  const deletePart = (index: number) => {
    const newParts = parts.filter((_, i) => i !== index);
    onChange(newParts);
  };

  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      {parts.map((part, index) => (
        <Card key={index} size="small" style={{ marginBottom: 4 }}>
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Select
                value={part.type}
                onChange={(v) => {
                  if (v === 'staticText') {
                    updatePart(index, { type: 'staticText', content: '' });
                  } else {
                    updatePart(index, { type: 'field', source: 'sample', fieldName: '' });
                  }
                }}
                options={[
                  { value: 'staticText', label: 'Text' },
                  { value: 'field', label: 'Field' },
                ]}
                size="small"
                style={{ width: 80 }}
              />
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => deletePart(index)}
              />
            </Space>
            {part.type === 'staticText' ? (
              <Input
                value={part.content}
                onChange={(e) => updatePart(index, { content: e.target.value })}
                placeholder="Enter text"
                size="small"
              />
            ) : (
              <Space orientation="vertical" style={{ width: '100%' }}>
                <Select
                  value={part.source}
                  onChange={(v) => updatePart(index, { source: v as DataSource, fieldName: '', dateFormat: undefined })}
                  options={[
                    { value: 'sample', label: 'Sample' },
                    { value: 'user', label: 'User' },
                  ]}
                  size="small"
                  style={{ width: '100%' }}
                />
                <Select
                  value={part.fieldName}
                  onChange={(v) => {
                    const selectedProp = properties.find((p) => p.name === v);
                    const isDate = selectedProp && (selectedProp.type === 'date' || selectedProp.type === 'datetime');
                    updatePart(index, { fieldName: v, dateFormat: isDate ? 'YYYY-MM-DD' : undefined });
                  }}
                  options={
                    part.source === 'user'
                      ? USER_FIELDS.map((f) => ({ value: f, label: f }))
                      : properties.map((p) => ({ value: p.name, label: p.name }))
                  }
                  placeholder="Select field"
                  size="small"
                  style={{ width: '100%' }}
                />
                {(() => {
                  if (part.source === 'user') return null;
                  const selectedProp = properties.find((p) => p.name === part.fieldName);
                  if (!selectedProp || (selectedProp.type !== 'date' && selectedProp.type !== 'datetime')) return null;
                  return (
                    <Select
                      value={part.dateFormat || 'YYYY-MM-DD'}
                      onChange={(v) => updatePart(index, { dateFormat: v })}
                      options={[
                        { value: 'YYYY-MM-DD', label: 'Date only' },
                        { value: 'YYYY-MM-DD HH:mm', label: 'Date + time' },
                      ]}
                      size="small"
                      style={{ width: '100%' }}
                    />
                  );
                })()}
              </Space>
            )}
          </Space>
        </Card>
      ))}
      <Space>
        <Button size="small" icon={<PlusOutlined />} onClick={addStaticText}>
          Text
        </Button>
        <Button size="small" icon={<PlusOutlined />} onClick={addField}>
          Field
        </Button>
      </Space>
    </Space>
  );
};

interface TemplateEditorProps {
  template: LabelTemplate;
  properties: SampleProperty[];
  onChange: (template: LabelTemplate) => void;
}

/** Creates a default element for a given type. */
function createDefaultElement(type: ElementType): TemplateElement {
  switch (type) {
    case 'field':
      return { type: 'field', source: 'sample', fieldName: '', row: 0, col: 0, rowSpan: 1, colSpan: 1 };
    case 'qrCode':
      return { type: 'qrCode', contentParts: [], row: 0, col: 0, rowSpan: 1, colSpan: 1 };
    case 'barcode':
      return { type: 'barcode', contentParts: [], row: 0, col: 0, rowSpan: 1, colSpan: 1 };
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

  // Calculate canvas size: use real mm values converted to pixels
  // Assume 96 DPI (standard screen), so 1mm ≈ 3.78 pixels
  const MM_TO_PX = 3.78;
  const canvasWidth = template.width * MM_TO_PX;
  const canvasHeight = template.height * MM_TO_PX;

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
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleResizeStart(e, index);
                      }}
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
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Button block onClick={() => addElement('field')}>+ Field</Button>
            <Button block onClick={() => addElement('qrCode')}>+ QR Code</Button>
            <Button block onClick={() => addElement('barcode')}>+ Barcode</Button>
            <Button block onClick={() => addElement('staticText')}>+ Static Text</Button>
          </Space>
        ) : selectedElementIndex !== null ? (
          <Space orientation="vertical" style={{ width: '100%' }}>
            {/* Back to Add panel button */}
            <Button block icon={<ArrowLeftOutlined />} onClick={() => setShowAddPanel(true)}>
              Back
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
              <Space orientation="vertical" style={{ width: '100%' }}>
                <div><Text>Row:</Text></div>
                <InputNumber
                  value={selectedElement.row}
                  onChange={(v) => updateElement(selectedElementIndex!, { row: v ?? 0 })}
                  min={0}
                  max={template.rows - 1}
                  size="small"
                  style={{ width: '100%' }}
                />
                <div><Text>Col:</Text></div>
                <InputNumber
                  value={selectedElement.col}
                  onChange={(v) => updateElement(selectedElementIndex!, { col: v ?? 0 })}
                  min={0}
                  max={template.cols - 1}
                  size="small"
                  style={{ width: '100%' }}
                />
              </Space>
            </Card>

            {/* Size */}
            <Card size="small" title="Size">
              <Space orientation="vertical" style={{ width: '100%' }}>
                <div><Text>Row Span:</Text></div>
                <InputNumber
                  value={selectedElement.rowSpan}
                  onChange={(v) => updateElement(selectedElementIndex!, { rowSpan: v ?? 1 })}
                  min={1}
                  max={template.rows - selectedElement.row}
                  size="small"
                  style={{ width: '100%' }}
                />
                <div><Text>Col Span:</Text></div>
                <InputNumber
                  value={selectedElement.colSpan}
                  onChange={(v) => updateElement(selectedElementIndex!, { colSpan: v ?? 1 })}
                  min={1}
                  max={template.cols - selectedElement.col}
                  size="small"
                  style={{ width: '100%' }}
                />
              </Space>
            </Card>

            {/* Content - Field */}
            {selectedElement.type === 'field' && (
              <Card size="small" title="Content">
                <Space orientation="vertical" style={{ width: '100%' }}>
                  <div><Text>Source:</Text></div>
                  <Select
                    value={selectedElement.source}
                    onChange={(v) => {
                      updateElement(selectedElementIndex!, {
                        source: v as DataSource,
                        fieldName: '',
                        dateFormat: undefined,
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
                      const selectedProp = properties.find((p) => p.name === v);
                      const isDate = selectedProp && (selectedProp.type === 'date' || selectedProp.type === 'datetime');
                      updateElement(selectedElementIndex!, { 
                        fieldName: v,
                        dateFormat: isDate ? 'YYYY-MM-DD' : undefined,
                      });
                    }}
                    options={
                      selectedElement.source === 'user'
                        ? USER_FIELDS.map((f) => ({ value: f, label: f }))
                        : properties.map((p) => ({ value: p.name, label: p.name }))
                    }
                    style={{ width: '100%' }}
                    size="small"
                  />
                  {(() => {
                    if (selectedElement.source === 'user') return null;
                    const selectedProp = properties.find((p) => p.name === selectedElement.fieldName);
                    if (!selectedProp || (selectedProp.type !== 'date' && selectedProp.type !== 'datetime')) return null;
                    return (
                      <>
                        <div><Text>Date Format:</Text></div>
                        <Select
                          value={selectedElement.dateFormat || 'YYYY-MM-DD'}
                          onChange={(v) => updateElement(selectedElementIndex!, { dateFormat: v })}
                          options={[
                            { value: 'YYYY-MM-DD', label: 'Date only (2024-01-15)' },
                            { value: 'YYYY-MM-DD HH:mm', label: 'Date and time (2024-01-15 14:36)' },
                          ]}
                          style={{ width: '100%' }}
                          size="small"
                        />
                      </>
                    );
                  })()}
                </Space>
              </Card>
            )}

            {/* Content - QR/Barcode */}
            {(selectedElement.type === 'qrCode' || selectedElement.type === 'barcode') && (
              <Card size="small" title="Content">
                <ContentPartsEditor
                  parts={selectedElement.contentParts}
                  properties={properties}
                  onChange={(parts) => updateElement(selectedElementIndex!, { contentParts: parts } as TemplateElement)}
                />
              </Card>
            )}

            {/* Content - Static Text */}
            {selectedElement.type === 'staticText' && (
              <Card size="small" title="Content">
                <Space orientation="vertical" style={{ width: '100%' }}>
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
                <Space orientation="vertical" style={{ width: '100%' }}>
                  <div><Text>Font Size:</Text></div>
                  <Space.Compact style={{ width: '100%' }}>
                    <InputNumber
                      value={(() => {
                        const fs = selectedElement.fontSize || '12px';
                        return parseInt(fs, 10) || 12;
                      })()}
                      onChange={(v) => {
                        const unit = (selectedElement.fontSize || '12px').replace(/\d+/, '') || 'px';
                        updateElement(selectedElementIndex!, { fontSize: `${v || 12}${unit}` });
                      }}
                      min={1}
                      size="small"
                      style={{ width: '70%' }}
                    />
                    <Select
                      value={(() => {
                        const fs = selectedElement.fontSize || '12px';
                        return fs.replace(/\d+/, '') || 'px';
                      })()}
                      onChange={(v) => {
                        const num = parseInt(selectedElement.fontSize || '12px', 10) || 12;
                        updateElement(selectedElementIndex!, { fontSize: `${num}${v}` });
                      }}
                      options={[
                        { value: 'px', label: 'px' },
                        { value: 'pt', label: 'pt' },
                      ]}
                      size="small"
                      style={{ width: '30%' }}
                    />
                  </Space.Compact>
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
  onReorder: (templates: LabelTemplate[]) => void;
}

export const TemplateList: React.FC<TemplateListProps> = ({
  templates,
  selectedId,
  onSelect,
  onAdd,
  onReorder,
}) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) return;

    const newTemplates = [...templates];
    const [draggedItem] = newTemplates.splice(dragIndex, 1);
    newTemplates.splice(dropIndex, 0, draggedItem);
    onReorder(newTemplates);
    setDragIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  return (
    <Space wrap style={{ width: '100%', marginBottom: 8 }}>
      {templates.map((tpl, index) => (
        <Button
          key={tpl.id}
          type={selectedId === tpl.id ? 'primary' : 'default'}
          onClick={() => onSelect(tpl.id)}
          size="small"
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          style={{
            opacity: dragIndex === index ? 0.5 : 1,
            cursor: 'move',
          }}
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
        New Template
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

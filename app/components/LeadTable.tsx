'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLeads, Lead, LeadFilters } from '../context/LeadContext';
import { useHeaders } from '../context/HeaderContext';
import { useColumns, ColumnConfig } from '../context/ColumnContext';
import EditableCell from './EditableCell';
import EditableHeaderCell from './EditableHeaderCell';
import MobileNumbersModal from './MobileNumbersModal';
import ColumnManagementModal from './ColumnManagementModal';

type SortField = keyof Lead | '';
type SortDirection = 'asc' | 'desc';

interface LeadTableProps {
  filters?: LeadFilters;
  onLeadClick?: (lead: Lead) => void;
  selectedLeads?: Set<string>;
  onLeadSelection?: (leadId: string, checked: boolean) => void;
  selectAll?: boolean;
  onSelectAll?: (checked: boolean) => void;
  leads?: Lead[]; // Allow passing custom leads array
  showActions?: boolean; // Show action buttons
  actionButtons?: (lead: Lead) => React.ReactNode; // Custom action buttons
  emptyMessage?: string; // Custom empty message
  className?: string; // Additional CSS classes
  editable?: boolean; // Enable inline editing
  onCellUpdate?: (leadId: string, field: string, value: string) => void; // Cell update callback
  validationErrors?: Record<string, Record<string, string>>; // Validation errors
  headerEditable?: boolean; // Enable header editing
  onColumnAdded?: (column: any) => void; // Column management callbacks
  onColumnDeleted?: (fieldKey: string) => void;
  onColumnReorder?: (newOrder: string[]) => void;
}

const LeadTable = React.memo(function LeadTable({ 
  filters = {}, 
  onLeadClick, 
  selectedLeads = new Set(), 
  onLeadSelection, 
  selectAll = false, 
  onSelectAll,
  leads: customLeads,
  showActions = false,
  actionButtons,
  emptyMessage = "No leads found matching the current filters.",
  className = "",
  editable = false,
  onCellUpdate,
  validationErrors = {},
  headerEditable = true,
  onColumnAdded,
  onColumnDeleted,
  onColumnReorder
}: LeadTableProps) {
  const { leads: contextLeads, getFilteredLeads } = useLeads();
  const { getDisplayName, updateHeader, headerConfig } = useHeaders();
  const { getVisibleColumns, getColumnByKey } = useColumns();
  const [sortField, setSortField] = useState<SortField>('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const [mobileModalOpen, setMobileModalOpen] = useState<string | null>(null);
  const [editingHeader, setEditingHeader] = useState<string | null>(null);
  const [columnManagementOpen, setColumnManagementOpen] = useState(false);
  const [columnOperation, setColumnOperation] = useState<{type: string, fieldKey?: string} | null>(null);

  // Use custom leads if provided, otherwise use context leads
  const leads = customLeads || contextLeads;

  // Force re-render when column configuration changes
  const [columnVersion, setColumnVersion] = useState(0);
  
  useEffect(() => {
    // Track visible column count to force re-render when columns change
    const currentColumns = getVisibleColumns();
    const columnCount = currentColumns.length;
    console.log('Column configuration updated:', columnCount, 'visible columns');
    setColumnVersion(columnCount);
  }, [getVisibleColumns]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (dropdownOpen) {
        setDropdownOpen(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // Handle cell update
  const handleCellUpdate = useCallback(async (leadId: string, field: string, value: string) => {
    if (onCellUpdate) {
      await onCellUpdate(leadId, field, value);
    }
  }, [onCellUpdate]);

  // Handle mobile numbers modal save
  const handleMobileModalSave = useCallback(async (updatedLead: Lead) => {
    if (onCellUpdate) {
      // Update the mobile numbers
      await onCellUpdate(updatedLead.id, 'mobileNumbers', JSON.stringify(updatedLead.mobileNumbers));
      // Update the main mobile number for backward compatibility
      const mainMobileNumber = updatedLead.mobileNumbers.find(m => m.isMain)?.number || updatedLead.mobileNumbers[0]?.number || '';
      await onCellUpdate(updatedLead.id, 'mobileNumber', mainMobileNumber);
    }
    setMobileModalOpen(null);
  }, [onCellUpdate]);

  // Handle header save
  const handleHeaderSave = useCallback((field: string, newLabel: string) => {
    try {
      updateHeader(field, newLabel);
      setEditingHeader(null);
    } catch (error) {
      console.error('Error updating header:', error);
      // Error will be handled by EditableHeaderCell component
    }
  }, [updateHeader]);

  // Column operation handlers
  const handleAddColumnBefore = useCallback((fieldKey: string) => {
    setColumnOperation({ type: 'addBefore', fieldKey });
    setColumnManagementOpen(true);
  }, []);

  const handleAddColumnAfter = useCallback((fieldKey: string) => {
    setColumnOperation({ type: 'addAfter', fieldKey });
    setColumnManagementOpen(true);
  }, []);

  const handleDeleteColumn = useCallback((fieldKey: string) => {
    setColumnOperation({ type: 'delete', fieldKey });
    setColumnManagementOpen(true);
  }, []);

  const handleColumnSettings = useCallback((fieldKey: string) => {
    setColumnOperation({ type: 'settings', fieldKey });
    setColumnManagementOpen(true);
  }, []);

  const handleColumnAdded = useCallback((column: any) => {
    console.log('Column added successfully:', column);
    onColumnAdded?.(column);
    setColumnManagementOpen(false);
    setColumnOperation(null);
    // Force table re-render
    console.log('Table will re-render with new column:', column.fieldKey);
    
    // Scroll headers into view after a short delay to allow for re-render
    setTimeout(() => {
      const tableContainer = document.querySelector('.table-container');
      if (tableContainer) {
        tableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }, [onColumnAdded]);

  const handleColumnDeleted = useCallback((fieldKey: string) => {
    console.log('Column deleted successfully:', fieldKey);
    onColumnDeleted?.(fieldKey);
    setColumnManagementOpen(false);
    setColumnOperation(null);
    // Force table re-render
    console.log('Table will re-render without column:', fieldKey);
  }, [onColumnDeleted]);
  
  // Get filtered leads
  const filteredLeads = useMemo(() => {
    if (customLeads) {
      // If custom leads are provided, return them as is (no filtering)
      return customLeads;
    }
    return getFilteredLeads(filters);
  }, [getFilteredLeads, filters, leads, customLeads]);

  // Helper function to parse dates for sorting
  const parseDateForSorting = useCallback((dateString: string): Date => {
    if (!dateString) return new Date(0); // Return epoch for empty dates
    
    // Handle DD-MM-YYYY format
    if (dateString.match(/^\d{2}-\d{2}-\d{4}$/)) {
      const [day, month, year] = dateString.split('-');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    // Handle ISO format or other formats
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? new Date(0) : date;
  }, []);

  // Helper function to parse numeric values for sorting
  const parseNumericForSorting = useCallback((value: string): number => {
    if (!value) return 0;
    
    // Extract numbers from the string
    const numericMatch = value.toString().match(/\d+/);
    return numericMatch ? parseInt(numericMatch[0]) : 0;
  }, []);
  
  // Sort leads based on current sort field and direction
  const sortedLeads = useMemo(() => {
    if (!sortField) return filteredLeads;
    
    // Get the column configuration for the sort field
    const column = getColumnByKey(sortField);
    
    return [...filteredLeads].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (aValue === undefined || bValue === undefined) return 0;
      
      let comparison = 0;
      
      // Handle date fields
      if (column?.type === 'date') {
        const aDate = parseDateForSorting(aValue);
        const bDate = parseDateForSorting(bValue);
        comparison = aDate.getTime() - bDate.getTime();
      }
      // Handle numeric fields
      else if (column?.type === 'number') {
        const aNum = parseNumericForSorting(aValue);
        const bNum = parseNumericForSorting(bValue);
        comparison = aNum - bNum;
      }
      // Handle string fields
      else if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else {
        comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredLeads, sortField, sortDirection, getColumnByKey]);
  
  console.log('LeadTable - sorted leads:', sortedLeads);
  
  // Handle column header click for sorting
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField, sortDirection]);
  
  // Render sort indicator
  const renderSortIndicator = useCallback((field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  }, [sortField, sortDirection]);
  
  // Format date for display in DD-MM-YYYY format
  const formatDate = useCallback((dateString: string) => {
    if (!dateString) return '';
    
    // If already in DD-MM-YYYY format, return as is
    if (dateString.match(/^\d{2}-\d{2}-\d{4}$/)) {
      return dateString;
    }
    
    // If it's a Date object or ISO string, convert to DD-MM-YYYY
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString; // Return original if invalid
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}-${month}-${year}`;
    } catch {
      return dateString; // Return original if conversion fails
    }
  }, []);
  
  // Get status color
  const getStatusColor = useCallback((status: Lead['status']) => {
    switch (status) {
      case 'New': return 'bg-blue-100 text-blue-800';
      case 'CNR': return 'bg-orange-100 text-orange-800';
      case 'Busy': return 'bg-yellow-100 text-yellow-800';
      case 'Follow-up': return 'bg-purple-100 text-purple-800';
      case 'Deal Close': return 'bg-green-100 text-green-800';
      case 'Work Alloted': return 'bg-indigo-100 text-indigo-800';
      case 'Hotlead': return 'bg-red-100 text-red-800';
      case 'Mandate Sent': return 'bg-teal-100 text-teal-800';
      case 'Documentation': return 'bg-cyan-100 text-cyan-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }, []);

  // Calculate column span for empty state
  const getColumnSpan = () => {
    let span = getVisibleColumns().length; // Use dynamic column count from configuration
    if (onLeadSelection) span += 1; // Add checkbox column
    if (showActions) span += 1; // Add actions column
    return span;
  };

  return (
    <div className={`overflow-x-auto relative ${className}`}>
      <table key={columnVersion} className="min-w-full divide-y divide-gray-200 bg-white table-container">
        <thead className="bg-gray-50 sticky top-0 z-30 shadow-sm">
          <tr>
            {onLeadSelection && (
              <th scope="col" className="px-0.5 py-1.5 text-left w-8">
                <div className="w-8 h-8 flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    ref={(input) => {
                      if (input) {
                        const selectedCount = selectedLeads ? selectedLeads.size : 0;
                        input.indeterminate = selectedCount > 0 && selectedCount < filteredLeads.length;
                      }
                    }}
                    onChange={(e) => onSelectAll && onSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    aria-label="Select all leads"
                  />
                </div>
              </th>
            )}
            {getVisibleColumns().map((column) => {
              const field = column.fieldKey;
              const isEditing = editingHeader === field;
              const displayName = getDisplayName(field);
              
              // Define column widths based on column configuration
              const getColumnWidth = (column: ColumnConfig) => {
                // Use column width from configuration, mapping to Tailwind classes
                if (column.width <= 100) return 'w-8';
                if (column.width <= 120) return 'w-8';
                if (column.width <= 150) return 'w-20';
                if (column.width <= 200) return 'w-32';
                if (column.width <= 250) return 'w-36';
                return 'w-40';
              };

              return (
                <th 
                  key={field}
                  scope="col" 
                  className={`px-0.5 py-1.5 text-left text-xs font-medium text-black uppercase tracking-wider ${!isEditing ? 'cursor-pointer hover:bg-gray-100' : ''} ${getColumnWidth(column)}`}
                  onClick={!isEditing ? () => handleSort(field) : undefined}
                >
                  {headerEditable ? (
                    <div className="flex items-center w-full">
                      <EditableHeaderCell
                        fieldKey={field}
                        currentLabel={displayName}
                        onSave={handleHeaderSave}
                        onCancel={() => setEditingHeader(null)}
                        disabled={!headerEditable}
                        className="flex-1"
                        onEditStart={(field) => setEditingHeader(field)}
                        onEditEnd={() => setEditingHeader(null)}
                        existingHeaders={Object.values(headerConfig)}
                        onAddColumnBefore={handleAddColumnBefore}
                        onAddColumnAfter={handleAddColumnAfter}
                        onDeleteColumn={handleDeleteColumn}
                        onColumnSettings={handleColumnSettings}
                      />
                      {!isEditing && renderSortIndicator(field)}
                    </div>
                  ) : (
                    <span className="flex items-center">
                      {displayName}
                      {renderSortIndicator(field)}
                    </span>
                  )}
                </th>
              );
            })}
            {showActions && (
              <th scope="col" className="px-0.5 py-1.5 text-left text-xs font-medium text-black uppercase tracking-wider w-20">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedLeads.length > 0 ? (
            sortedLeads.map((lead) => (
              <tr 
                key={lead.id} 
                className="cursor-pointer hover:bg-gray-50 transition-colors duration-150"
                onClick={() => onLeadClick && onLeadClick(lead)}
              >
                {onLeadSelection && (
                  <td className="px-0.5 py-0.5 whitespace-nowrap">
                    <div className="w-9 h-8 flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={selectedLeads.has(lead.id)}
                        onChange={(e) => onLeadSelection && onLeadSelection(lead.id, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        aria-label={`Select lead ${lead.kva}`}
                      />
                    </div>
                  </td>
                )}
                {getVisibleColumns().map((column) => {
                  const fieldKey = column.fieldKey;
                  const value = (lead as any)[fieldKey] ?? '';
                  
                  // Debug logging for dynamic columns
                  if (!(fieldKey in lead)) {
                    console.log(`Dynamic column "${fieldKey}" not found in lead data, using default value`);
                  }
                  
                  // Get the column configuration for this field
                  const columnConfig = getColumnByKey(fieldKey);
                  const defaultValue = columnConfig?.defaultValue || '';
                  const displayValue = (lead as any)[fieldKey] ?? defaultValue;
                  
                  // Special handling for mobile number field
                  if (fieldKey === 'mobileNumber') {
                    return (
                      <td key={fieldKey} className="px-0.5 py-0.5 whitespace-nowrap">
                        {editable ? (
                          <div className="flex items-center space-x-1">
                            <EditableCell
                              value={(lead.mobileNumbers?.find(m => m.isMain)?.number || lead.mobileNumber)?.replace(/-/g, '') || ''}
                              type="number"
                              onSave={(val) => {
                                // Update the main mobile number
                                const updatedMobileNumbers = [...(lead.mobileNumbers || [])];
                                const mainIndex = updatedMobileNumbers.findIndex(m => m.isMain);
                                if (mainIndex >= 0) {
                                  updatedMobileNumbers[mainIndex] = { ...updatedMobileNumbers[mainIndex], number: val };
                                } else if (updatedMobileNumbers.length > 0) {
                                  updatedMobileNumbers[0] = { ...updatedMobileNumbers[0], number: val };
                                }
                                handleCellUpdate(lead.id, 'mobileNumbers', JSON.stringify(updatedMobileNumbers));
                                handleCellUpdate(lead.id, 'mobileNumber', val);
                              }}
                              placeholder="Mobile number"
                              fieldName="mobileNumber"
                              lead={lead}
                              className="text-xs max-w-12 truncate flex-1"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMobileModalOpen(lead.id);
                              }}
                              className="px-1 py-0.5 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                              title="Edit all mobile numbers"
                            >
                              ...
                            </button>
                          </div>
                        ) : (
                          <div className="px-1 text-xs text-black max-w-12 truncate">
                            {(lead.mobileNumbers?.find(m => m.isMain)?.number || lead.mobileNumber)?.replace(/-/g, '') || ''}
                          </div>
                        )}
                      </td>
                    );
                  }
                  
                  // Special handling for status field
                  if (fieldKey === 'status') {
                    return (
                      <td key={fieldKey} className="px-0.5 py-0.5 whitespace-nowrap">
                        {editable ? (
                          <EditableCell
                            value={value}
                            type={column.type}
                            options={column.options || ['New', 'CNR', 'Busy', 'Follow-up', 'Deal Close', 'Work Alloted', 'Hotlead', 'Mandate Sent', 'Documentation', 'Others']}
                            onSave={(val) => handleCellUpdate(lead.id, fieldKey, val)}
                            placeholder="Select Status"
                            fieldName={fieldKey}
                            lead={lead}
                            className="text-xs"
                          />
                        ) : (
                          <span className={`px-1 inline-flex text-xs leading-5 font-semibold rounded-full max-w-16 truncate ${getStatusColor(lead.status)}`}>
                            {lead.status === 'Work Alloted' ? 'WAO' : lead.status}
                          </span>
                        )}
                      </td>
                    );
                  }
                  
                  // Special handling for date fields
                  if (column.type === 'date') {
                    return (
                      <td key={fieldKey} className="px-0.5 py-0.5 whitespace-nowrap">
                        {editable ? (
                          <EditableCell
                            value={formatDate(value)}
                            type="date"
                            onSave={(val) => handleCellUpdate(lead.id, fieldKey, val)}
                            placeholder="DD-MM-YYYY"
                            fieldName={fieldKey}
                            lead={lead}
                            className="text-xs min-w-16"
                          />
                        ) : (
                          <div className="text-xs text-black min-w-16">{formatDate(value)}</div>
                        )}
                      </td>
                    );
                  }
                  
                  // Default handling for other fields
                  return (
                    <td key={fieldKey} className="px-0.5 py-0.5 whitespace-nowrap">
                      {editable ? (
                        <EditableCell
                          value={displayValue}
                          type={column.type}
                          options={column.options}
                          onSave={(val) => handleCellUpdate(lead.id, fieldKey, val)}
                          placeholder={`Enter ${column.label.toLowerCase()}`}
                          fieldName={fieldKey}
                          lead={lead}
                          className="text-xs"
                        />
                      ) : (
                        <div className="text-xs text-black truncate" title={displayValue}>
                          {displayValue || defaultValue || 'N/A'}
                        </div>
                      )}
                    </td>
                  );
                })}
                {showActions && (
                  <td className="px-0.5 py-0.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {actionButtons && actionButtons(lead)}
                  </td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={getColumnSpan()} className="px-0.5 py-0.5 text-center text-xs text-black">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      
      {/* Mobile Numbers Modal */}
      {mobileModalOpen && (
        <MobileNumbersModal
          isOpen={true}
          onClose={() => setMobileModalOpen(null)}
          lead={sortedLeads.find(lead => lead.id === mobileModalOpen)!}
          onSave={handleMobileModalSave}
        />
      )}

      {/* Column Management Modal */}
      <ColumnManagementModal
        isOpen={columnManagementOpen}
        onClose={() => {
          setColumnManagementOpen(false);
          setColumnOperation(null);
        }}
        onColumnAdded={handleColumnAdded}
        onColumnDeleted={handleColumnDeleted}
        operation={columnOperation}
      />
    </div>
  );
});

export default LeadTable;